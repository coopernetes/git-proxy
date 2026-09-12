import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { enumerateIntroduced } from '../../../src/git/enumerate';
import { DEFAULT_LIMITS } from '../../../src/git/limits';
import { MirrorEntry } from '../../../src/git/mirror';
import { createPackAdmission } from '../../../src/git/pack';
import { Quarantine, createQuarantineStore } from '../../../src/git/quarantine';
import { Fixture, ZERO, chunks, commit, makeFixture, out, packFor, sh } from './helpers';

let fx: Fixture;
let mirror: MirrorEntry;
let n = 0;

async function admitted(oldOid: string, newOid: string): Promise<Quarantine> {
  const q = await createQuarantineStore(path.join(fx.root, 'quarantine')).create(
    `p_enum${String(++n).padStart(8, '0')}`,
    mirror,
  );
  if (newOid !== ZERO)
    await createPackAdmission().admit({
      source: chunks(packFor(fx.clone, oldOid, newOid)),
      objectDir: q.objectDir,
      mirrorDir: fx.mirror,
      limits: DEFAULT_LIMITS,
    });
  return q;
}

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

describe('enumerateIntroduced', () => {
  it('returns the new commits with author, message, parents, and the objects with sizes', async () => {
    const c1 = commit(
      fx.clone,
      'a.txt',
      'a\n',
      'feat: a\n\nbody line\n\nSigned-off-by: Alice <alice@example.com>',
    );
    const c2 = commit(fx.clone, 'b.txt', 'bb\n', 'feat: b');
    const q = await admitted(fx.seed, c2);
    const r = await enumerateIntroduced(
      q,
      { ref: 'refs/heads/main', oldOid: fx.seed, newOid: c2 },
      'sha1',
    );
    expect(r.commits.map((c) => c.oid).sort()).toEqual([c1, c2].sort());
    const a = r.commits.find((c) => c.oid === c1)!;
    expect(a.author).toMatchObject({ name: 'Alice', email: 'alice@example.com' });
    expect(a.parents).toEqual([fx.seed]);
    expect(a.message.startsWith('feat: a')).toBe(true);
    expect(a.trailers).toEqual({ 'Signed-off-by': ['Alice <alice@example.com>'] });
    expect(r.commits.find((c) => c.oid === c2)!.parents).toEqual([c1]);
    expect(r.tag).toBeUndefined();
    const types = new Set(r.objects.map((o) => o.type));
    expect(types).toEqual(new Set(['commit', 'tree', 'blob']));
    expect(r.objects.find((o) => o.type === 'blob' && o.size === 3)).toBeTruthy(); // "bb\n"
  });

  it('a branch creation reports only what the mirror does not already hold', async () => {
    sh(['checkout', '-q', '-b', 'feature', 'main'], fx.clone);
    const c = commit(fx.clone, 'f.txt', 'f\n', 'feat: f');
    const q = await admitted(ZERO, c);
    const r = await enumerateIntroduced(
      q,
      { ref: 'refs/heads/feature', oldOid: ZERO, newOid: c },
      'sha1',
    );
    // main's commits are already in the mirror only up to the seed; the two earlier commits were never forwarded, so they count as introduced.
    expect(r.commits.map((x) => x.oid)).toContain(c);
    expect(r.commits.map((x) => x.oid)).not.toContain(fx.seed);
    sh(['checkout', '-q', 'main'], fx.clone);
  });

  it('a deletion introduces nothing', async () => {
    const q = await admitted(fx.seed, ZERO);
    const r = await enumerateIntroduced(
      q,
      { ref: 'refs/heads/main', oldOid: fx.seed, newOid: ZERO },
      'sha1',
    );
    expect(r).toEqual({ commits: [], objects: [] });
  });

  it('an annotated tag push returns the tag object with tagger and message', async () => {
    sh(['tag', '-a', 'v1', '-m', 'release one'], fx.clone);
    const tagOid = out(['rev-parse', 'v1'], fx.clone);
    const q = await admitted(ZERO, tagOid);
    const r = await enumerateIntroduced(
      q,
      { ref: 'refs/tags/v1', oldOid: ZERO, newOid: tagOid },
      'sha1',
    );
    expect(r.tag).toMatchObject({
      oid: tagOid,
      name: 'v1',
      targetType: 'commit',
      message: 'release one\n',
    });
    expect(r.tag?.tagger).toMatchObject({ name: 'Alice', email: 'alice@example.com' });
    expect(r.tag?.targetOid).toBe(out(['rev-parse', 'v1^{commit}'], fx.clone));
  });
});
