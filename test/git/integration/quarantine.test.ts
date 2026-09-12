import { existsSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_LIMITS } from '../../../src/git/limits';
import { MirrorEntry } from '../../../src/git/mirror';
import { createPackAdmission } from '../../../src/git/pack';
import { createQuarantineStore } from '../../../src/git/quarantine';
import { Fixture, ZERO, chunks, commit, makeFixture, out, packFor, sh } from './helpers';

let fx: Fixture;
let mirror: MirrorEntry;
const store = () => createQuarantineStore(path.join(fx.root, 'quarantine'));

beforeAll(() => {
  fx = makeFixture();
  mirror = {
    key: {
      repository: { providerId: 'p', host: 'h', owner: 'o', name: 'n' },
      upstreamUrlDigest: 'd',
    },
    path: fx.mirror,
  };
});
afterAll(() => fx.cleanup());

describe('createQuarantineStore', () => {
  it('refuses ids that are not opaque tokens', async () => {
    for (const id of ['../x', 'a/b', '', 'x', 'p_' + 'a'.repeat(70), 'p_1234;rm'])
      await expect(store().create(id, mirror)).rejects.toThrow(/opaque/);
  });

  it('creates the directory and exposes the environment', async () => {
    const q = await store().create('p_abcdef012345', mirror);
    expect(existsSync(path.join(q.objectDir, 'pack'))).toBe(true);
    expect(q.env()).toEqual({
      GIT_OBJECT_DIRECTORY: q.objectDir,
      GIT_ALTERNATE_OBJECT_DIRECTORIES: `${fx.mirror}/objects`,
    });
    await q.discard();
    expect(existsSync(q.objectDir)).toBe(false);
  });

  it('verifyComplete is true for a pack of exactly the introduced objects', async () => {
    const q = await store().create('p_complete0001', mirror);
    const newOid = commit(fx.clone, 'a.txt', 'a\n', 'feat: a');
    await createPackAdmission().admit({
      source: chunks(packFor(fx.clone, fx.seed, newOid)),
      objectDir: q.objectDir,
      mirrorDir: fx.mirror,
      limits: DEFAULT_LIMITS,
    });
    expect(await store().verifyComplete(q, { oldOid: fx.seed, newOid })).toEqual({
      complete: true,
      unreachable: [],
    });
  });

  it('verifyComplete lists objects in the pack that the ref update does not reach', async () => {
    // The mirror still holds only the seed (nothing above was forwarded), so the range is measured from it.
    const tip = fx.seed;
    // A dangling commit on a throwaway branch, packed alongside the real update.
    sh(['checkout', '-q', '-b', 'dangling'], fx.clone);
    const dangling = commit(fx.clone, 'd.txt', 'd\n', 'hidden');
    sh(['checkout', '-q', 'main'], fx.clone);
    const newOid = commit(fx.clone, 'e.txt', 'e\n', 'feat: e');
    const q = await store().create('p_hidden000001', mirror);
    await createPackAdmission().admit({
      source: chunks(packFor(fx.clone, tip, newOid, [dangling])),
      objectDir: q.objectDir,
      mirrorDir: fx.mirror,
      limits: DEFAULT_LIMITS,
    });
    const result = await store().verifyComplete(q, { oldOid: tip, newOid });
    expect(result.complete).toBe(false);
    expect(result.unreachable).toContain(dangling);
  });

  it('verifyComplete is true for an empty pack (deletion)', async () => {
    const q = await store().create('p_deletion0001', mirror);
    expect(await store().verifyComplete(q, { oldOid: fx.seed, newOid: ZERO })).toEqual({
      complete: true,
      unreachable: [],
    });
  });
});
