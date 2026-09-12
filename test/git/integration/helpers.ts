import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

export const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'Alice',
  GIT_AUTHOR_EMAIL: 'alice@example.com',
  GIT_COMMITTER_NAME: 'Alice',
  GIT_COMMITTER_EMAIL: 'alice@example.com',
  GIT_AUTHOR_DATE: '2026-01-01T00:00:00Z',
  GIT_COMMITTER_DATE: '2026-01-01T00:00:00Z',
  GIT_TERMINAL_PROMPT: '0',
};

export const sh = (args: string[], cwd?: string, input?: Buffer | string): Buffer =>
  execFileSync('git', args, { cwd, env: GIT_ENV, input, maxBuffer: 64 * 1024 * 1024 });

export const out = (args: string[], cwd?: string): string => sh(args, cwd).toString().trim();

export interface Fixture {
  root: string;
  upstream: string;
  mirror: string;
  clone: string;
  /** Oid of the seed commit on main. */
  seed: string;
  cleanup(): void;
}

/** Bare upstream with one commit on main, a mirror clone of it, and a working clone. */
export function makeFixture(): Fixture {
  const root = mkdtempSync(path.join(tmpdir(), 'gitproxy-test-'));
  const upstream = path.join(root, 'upstream.git');
  const mirror = path.join(root, 'mirror.git');
  const clone = path.join(root, 'clone');
  sh(['init', '-q', '--bare', '-b', 'main', upstream]);
  const seedDir = path.join(root, 'seed');
  sh(['clone', '-q', upstream, seedDir]);
  writeFileSync(path.join(seedDir, 'README'), 'hello\n');
  sh(['add', 'README'], seedDir);
  sh(['commit', '-qm', 'initial'], seedDir);
  sh(['push', '-q', 'origin', 'main'], seedDir);
  sh(['clone', '-q', '--mirror', upstream, mirror]);
  sh(['clone', '-q', upstream, clone]);
  const seed = out(['rev-parse', 'HEAD'], clone);
  return {
    root,
    upstream,
    mirror,
    clone,
    seed,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

/** Adds a file and commits it in the clone; returns the new oid. */
export function commit(clone: string, file: string, content: string, message: string): string {
  writeFileSync(path.join(clone, file), content);
  sh(['add', file], clone);
  sh(['commit', '-qm', message], clone);
  return out(['rev-parse', 'HEAD'], clone);
}

export const ZERO = '0'.repeat(40);

/**
 * The bytes a client sends for a push: a thin pack of `newOid` minus `oldOid`
 * (or minus nothing for a creation). Extra oids are included too, to build
 * packs carrying objects unreachable from the ref update.
 */
export function packFor(
  clone: string,
  oldOid: string,
  newOid: string,
  extra: string[] = [],
): Buffer {
  const revs = [newOid, ...extra, ...(oldOid === ZERO ? [] : [`^${oldOid}`])].join('\n') + '\n';
  return sh(
    ['pack-objects', '--revs', '--thin', '--stdout', '--delta-base-offset', '-q'],
    clone,
    revs,
  );
}

export async function* chunks(buf: Buffer, size = 4096): AsyncIterable<Uint8Array> {
  for (let i = 0; i < buf.length; i += size) yield buf.subarray(i, i + size);
}

export async function* empty(): AsyncIterable<Uint8Array> {}
