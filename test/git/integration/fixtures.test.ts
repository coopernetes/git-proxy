/**
 * Replays real `git push` request bodies (captured by test/git/fixtures/capture.ts)
 * through the receive path: pkt-line reader, command parsing, pack admission
 * into a quarantine over a mirror rebuilt from the seed bundle, completeness
 * verification and content enumeration.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  DEFAULT_LIMITS,
  LimitExceededError,
  createPackAdmission,
  createQuarantineStore,
  createReader,
  enumerateIntroduced,
  parseReceivePackCommands,
} from '../../../src/git';
import type { MirrorEntry } from '../../../src/git';

const fixtures = path.resolve(__dirname, '../fixtures');
const body = (name: string) => readFileSync(path.join(fixtures, name));
async function* once(b: Buffer): AsyncIterable<Uint8Array> {
  // Deliver in small chunks so packet boundaries fall inside chunks.
  for (let i = 0; i < b.length; i += 37) yield b.subarray(i, i + 37);
}

let work: string;
let mirror: MirrorEntry;
const repo = { providerId: 'fixture', host: 'fixture', owner: 'acme', name: 'repo' };

beforeAll(() => {
  work = mkdtempSync(path.join(tmpdir(), 'fixture-replay-'));
  const dir = path.join(work, 'mirror.git');
  execFileSync('git', ['clone', '-q', '--mirror', path.join(fixtures, 'seed.bundle'), dir]);
  mirror = { key: { repository: repo, upstreamUrlDigest: 'seed' }, path: dir };
});
afterAll(() => rmSync(work, { recursive: true, force: true }));

async function receive(name: string) {
  const reader = createReader(once(body(name)), DEFAULT_LIMITS);
  const commands = await parseReceivePackCommands(reader, DEFAULT_LIMITS);
  const store = createQuarantineStore(path.join(work, 'quarantine'));
  const q = await store.create(`q_${name.replace(/\W/g, '')}`, mirror);
  const summary = await createPackAdmission().admit({
    source: reader.remainder(),
    objectDir: q.objectDir,
    mirrorDir: mirror.path,
    limits: DEFAULT_LIMITS,
  });
  const completeness = await store.verifyComplete(q, commands.updates[0]);
  const content = await enumerateIntroduced(q, commands.updates[0], commands.objectFormat);
  return { commands, summary, completeness, content };
}

describe('captured push bodies', () => {
  it('a branch update: one commit, thin pack resolved against the seed, complete', async () => {
    const r = await receive('push-update.bin');
    expect(r.commands.updates[0].ref).toBe('refs/heads/main');
    expect(r.commands.capabilities).toContain('side-band-64k');
    expect(r.commands.capabilities.some((c) => c.startsWith('report-status'))).toBe(true);
    expect(r.commands.objectFormat).toBe('sha1');
    expect(r.summary.objectCount).toBe(3); // commit, tree, blob
    expect(r.completeness.complete).toBe(true);
    expect(r.content.commits.map((c) => c.message.trim())).toEqual(['feat: first change']);
    expect(r.content.commits[0].author.email).toBe('fixture@example.com');
    expect(r.content.objects.map((o) => o.type).sort()).toEqual(['blob', 'commit', 'tree']);
  });

  it('a branch creation introduces only what the mirror lacks', async () => {
    const r = await receive('push-create.bin');
    expect(r.commands.updates[0]).toMatchObject({
      ref: 'refs/heads/feature',
      oldOid: '0'.repeat(40),
    });
    expect(r.completeness.complete).toBe(true);
    expect(r.content.commits).toHaveLength(1);
  });

  it('an annotated tag is enumerated as a tag object with its tagger and message', async () => {
    const r = await receive('push-tag.bin');
    expect(r.commands.updates[0].ref).toBe('refs/tags/v1');
    expect(r.content.tag).toMatchObject({ name: 'v1', targetType: 'commit' });
    expect(r.content.tag?.tagger?.email).toBe('fixture@example.com');
    expect(r.content.tag?.message.trim()).toBe('release v1');
  });

  it('a push updating two refs is refused before any object is read', async () => {
    const reader = createReader(once(body('push-two-refs.bin')), DEFAULT_LIMITS);
    await expect(parseReceivePackCommands(reader, DEFAULT_LIMITS)).rejects.toBeInstanceOf(
      LimitExceededError,
    );
  });

  it('the same body under a tiny body ceiling is refused while streaming', async () => {
    const reader = createReader(once(body('push-update.bin')), DEFAULT_LIMITS);
    const commands = await parseReceivePackCommands(reader, DEFAULT_LIMITS);
    const store = createQuarantineStore(path.join(work, 'quarantine'));
    const q = await store.create('q_small', mirror);
    await expect(
      createPackAdmission().admit({
        source: reader.remainder(),
        objectDir: q.objectDir,
        mirrorDir: mirror.path,
        limits: { ...DEFAULT_LIMITS, maxRequestBodyBytes: 100 },
      }),
    ).rejects.toBeInstanceOf(LimitExceededError);
    expect(commands.updates).toHaveLength(1);
  });
});
