import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createForwarder, credentialEnv } from '../../../src/git/forwarder';
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
    `p_fwd${String(++n).padStart(9, '0')}`,
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

describe('credentialEnv', () => {
  it('passes a relayed header through git config and an agent through its socket', () => {
    expect(credentialEnv({ kind: 'client-relayed', header: 'Basic abc' })).toEqual({
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'http.extraHeader',
      GIT_CONFIG_VALUE_0: 'Authorization: Basic abc',
    });
    expect(credentialEnv({ kind: 'agent-forwarded', agentSocket: '/tmp/s' })).toEqual({
      SSH_AUTH_SOCK: '/tmp/s',
    });
    expect(credentialEnv({ kind: 'none' })).toEqual({});
  });
});

describe('createForwarder', () => {
  it('forwards an admitted push to the upstream and refreshes the mirror', async () => {
    const newOid = commit(fx.clone, 'a.txt', 'a\n', 'feat: a');
    const q = await admitted(fx.seed, newOid);
    const update = { ref: 'refs/heads/main', oldOid: fx.seed, newOid };
    const result = await createForwarder().forward({
      quarantine: q,
      upstreamUrl: fx.upstream,
      update,
      credential: { kind: 'none' },
    });
    expect(result.refs).toEqual([{ ref: 'refs/heads/main', ok: true }]);
    expect(out(['rev-parse', 'refs/heads/main'], fx.upstream)).toBe(newOid);
    expect(out(['rev-parse', 'refs/heads/main'], fx.mirror)).toBe(newOid);
    // The objects must live in the mirror itself, not only in the quarantine that is about to be discarded.
    await q.discard();
    expect(out(['cat-file', '-t', newOid], fx.mirror)).toBe('commit');
  });

  it('reports a non-fast-forward as a per-ref failure with the reason', async () => {
    // Diverge: the clone commits on top of the seed while upstream main is ahead.
    const tip = out(['rev-parse', 'refs/heads/main'], fx.upstream);
    sh(['checkout', '-q', '-b', 'stale', fx.seed], fx.clone);
    const stale = commit(fx.clone, 's.txt', 's\n', 'feat: stale');
    const q = await admitted(fx.seed, stale);
    const result = await createForwarder().forward({
      quarantine: q,
      upstreamUrl: fx.upstream,
      update: { ref: 'refs/heads/main', oldOid: fx.seed, newOid: stale },
      credential: { kind: 'none' },
    });
    expect(result.refs).toHaveLength(1);
    expect(result.refs[0]).toMatchObject({ ref: 'refs/heads/main', ok: false });
    expect((result.refs[0] as { reason: string }).reason).toMatch(
      /fetch first|non-fast-forward|rejected/,
    );
    expect(out(['rev-parse', 'refs/heads/main'], fx.upstream)).toBe(tip);
    sh(['checkout', '-q', 'main'], fx.clone);
  });

  it('creates a branch and then deletes it', async () => {
    sh(['checkout', '-q', '-b', 'topic', 'main'], fx.clone);
    const c = commit(fx.clone, 't.txt', 't\n', 'feat: topic');
    const q = await admitted(ZERO, c);
    const create = await createForwarder().forward({
      quarantine: q,
      upstreamUrl: fx.upstream,
      update: { ref: 'refs/heads/topic', oldOid: ZERO, newOid: c },
      credential: { kind: 'none' },
    });
    expect(create.refs).toEqual([{ ref: 'refs/heads/topic', ok: true }]);
    expect(out(['rev-parse', 'refs/heads/topic'], fx.upstream)).toBe(c);

    const q2 = await admitted(c, ZERO);
    const del = await createForwarder().forward({
      quarantine: q2,
      upstreamUrl: fx.upstream,
      update: { ref: 'refs/heads/topic', oldOid: c, newOid: ZERO },
      credential: { kind: 'none' },
    });
    expect(del.refs).toEqual([{ ref: 'refs/heads/topic', ok: true }]);
    expect(() => out(['rev-parse', '--verify', 'refs/heads/topic'], fx.upstream)).toThrow();
    expect(() => out(['rev-parse', '--verify', 'refs/heads/topic'], fx.mirror)).toThrow();
    sh(['checkout', '-q', 'main'], fx.clone);
  });
});
