/**
 * Mirror cache: one bare mirror per upstream repository, keyed by the
 * canonical repository identity plus a digest of the full upstream URL so
 * two upstreams that sanitise to the same name never share a mirror.
 * Clones of different repositories proceed in parallel; work on the same
 * key is serialised by a per-key lock.
 */

import { createHash } from 'node:crypto';
import { mkdir, rm, stat, readdir } from 'node:fs/promises';
import path from 'node:path';
import { RepositoryIdentity } from '../domain';
import { git } from './run';

export type MirrorMode = 'shared' | 'ephemeral' | 'off';

export interface MirrorKey {
  repository: RepositoryIdentity;
  upstreamUrlDigest: string;
}

export interface MirrorEntry {
  key: MirrorKey;
  /** The bare git directory. */
  path: string;
  lastFetchAt?: string;
}

export interface MirrorCache {
  readonly mode: MirrorMode;
  getOrFetch(
    key: MirrorKey,
    upstreamUrl: string,
    env?: Record<string, string>,
  ): Promise<MirrorEntry>;
  invalidate(key: MirrorKey): Promise<void>;
  invalidateAll(): Promise<void>;
  list(): Promise<MirrorEntry[]>;
}

export function mirrorKey(repository: RepositoryIdentity, upstreamUrl: string): MirrorKey {
  return {
    repository,
    upstreamUrlDigest: createHash('sha256').update(stripCredentials(upstreamUrl)).digest('hex'),
  };
}

const safe = (s: string) => s.replace(/[^A-Za-z0-9._-]/g, '_');

export function createMirrorCache(root: string, mode: MirrorMode = 'shared'): MirrorCache {
  const locks = new Map<string, Promise<unknown>>();
  const entries = new Map<string, MirrorEntry>();

  const dirFor = (key: MirrorKey) =>
    path.join(
      root,
      safe(key.repository.host),
      safe(key.repository.owner),
      `${safe(key.repository.name)}-${key.upstreamUrlDigest.slice(0, 12)}.git`,
    );

  const withLock = async <T>(id: string, fn: () => Promise<T>): Promise<T> => {
    const prev = locks.get(id) ?? Promise.resolve();
    const next = prev.then(fn, fn);
    locks.set(
      id,
      next.catch(() => undefined),
    );
    try {
      return await next;
    } finally {
      if (locks.get(id) === next.catch(() => undefined)) locks.delete(id);
    }
  };

  return {
    mode,
    async getOrFetch(key, upstreamUrl, env = {}) {
      if (mode === 'off') throw new Error('mirror cache is off');
      const dir = dirFor(key);
      const id = `${dir}`;
      return withLock(id, async () => {
        const exists = await stat(path.join(dir, 'HEAD')).then(
          () => true,
          () => false,
        );
        if (!exists) {
          await mkdir(path.dirname(dir), { recursive: true });
          await git(['clone', '--quiet', '--mirror', upstreamUrl, dir], { env });
          // The upstream URL, credentials and all, must not persist in the mirror's config.
          await git(['remote', 'set-url', 'origin', stripCredentials(upstreamUrl)], { cwd: dir });
        } else {
          await git(['fetch', '--quiet', '--prune', upstreamUrl, '+refs/*:refs/*'], {
            cwd: dir,
            env,
          });
        }
        const entry: MirrorEntry = { key, path: dir, lastFetchAt: new Date().toISOString() };
        entries.set(id, entry);
        return entry;
      });
    },
    async invalidate(key) {
      const dir = dirFor(key);
      await withLock(dir, async () => {
        await rm(dir, { recursive: true, force: true });
        entries.delete(dir);
      });
    },
    async invalidateAll() {
      for (const dir of [...entries.keys()]) await rm(dir, { recursive: true, force: true });
      entries.clear();
      await readdir(root).catch(() => []);
    },
    async list() {
      return [...entries.values()];
    },
  };
}

/** Removes userinfo from a URL. A bare filesystem path or scp-style address is a valid git upstream and is returned unchanged. */
export function stripCredentials(url: string): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    // Not a WHATWG URL (bare path, scp-style, or a form the parser refuses): strip any userinfo textually.
    return url.replace(/^([a-z][a-z0-9+.-]*:\/\/)[^/@]+@/i, '$1');
  }
  u.username = '';
  u.password = '';
  return u.toString();
}
