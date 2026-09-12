import { existsSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createMirrorCache, mirrorKey } from '../../../src/git/mirror';
import { Fixture, commit, makeFixture, out, sh } from './helpers';

let fx: Fixture;
const repo = { providerId: 'local', host: 'localhost', owner: 'acme', name: 'widgets' };

beforeAll(() => {
  fx = makeFixture();
});
afterAll(() => fx.cleanup());

describe('mirrorKey', () => {
  it('digests the full upstream URL, so a different port is a different mirror', () => {
    const a = mirrorKey(repo, 'https://host:443/acme/widgets.git');
    const b = mirrorKey(repo, 'https://host:8443/acme/widgets.git');
    expect(a.upstreamUrlDigest).not.toBe(b.upstreamUrlDigest);
  });
  it('ignores credentials in the URL', () => {
    expect(mirrorKey(repo, 'https://u:p@host/a/b.git').upstreamUrlDigest).toBe(
      mirrorKey(repo, 'https://host/a/b.git').upstreamUrlDigest,
    );
  });
});

describe('createMirrorCache', () => {
  it('clones on the first call and fetches on the next', async () => {
    const cache = createMirrorCache(path.join(fx.root, 'mirrors'));
    const key = mirrorKey(repo, fx.upstream);
    const first = await cache.getOrFetch(key, fx.upstream);
    expect(existsSync(path.join(first.path, 'HEAD'))).toBe(true);
    expect(out(['rev-parse', 'refs/heads/main'], first.path)).toBe(fx.seed);
    // Advance the upstream, then fetch through the cache.
    const c = commit(fx.clone, 'a.txt', 'a\n', 'feat: a');
    sh(['push', '-q', 'origin', 'main'], fx.clone);
    const second = await cache.getOrFetch(key, fx.upstream);
    expect(second.path).toBe(first.path);
    expect(out(['rev-parse', 'refs/heads/main'], second.path)).toBe(c);
    expect((await cache.list()).map((e) => e.path)).toEqual([first.path]);
  });

  it('does not persist credentials from the upstream URL', async () => {
    const cache = createMirrorCache(path.join(fx.root, 'mirrors-cred'));
    // A file URL with userinfo is accepted by URL parsing; git ignores it for file transport.
    const url = `file://${fx.upstream}`;
    const withCreds = `file://user:secret@${fx.upstream}`;
    const entry = await cache
      .getOrFetch(mirrorKey(repo, withCreds), withCreds)
      .catch(() => cache.getOrFetch(mirrorKey(repo, url), url));
    expect(out(['config', 'remote.origin.url'], entry.path)).not.toContain('secret');
  });

  it('serialises concurrent calls for one key into a single clone', async () => {
    const cache = createMirrorCache(path.join(fx.root, 'mirrors-concurrent'));
    const key = mirrorKey(repo, fx.upstream);
    const [a, b] = await Promise.all([
      cache.getOrFetch(key, fx.upstream),
      cache.getOrFetch(key, fx.upstream),
    ]);
    expect(a.path).toBe(b.path);
    expect((await cache.list()).length).toBe(1);
    expect(existsSync(path.join(a.path, 'HEAD'))).toBe(true);
  });

  it('invalidate removes the mirror', async () => {
    const cache = createMirrorCache(path.join(fx.root, 'mirrors-inv'));
    const key = mirrorKey(repo, fx.upstream);
    const entry = await cache.getOrFetch(key, fx.upstream);
    await cache.invalidate(key);
    expect(existsSync(entry.path)).toBe(false);
    expect(await cache.list()).toEqual([]);
  });

  it('refuses to operate when off', async () => {
    const cache = createMirrorCache(path.join(fx.root, 'mirrors-off'), 'off');
    await expect(cache.getOrFetch(mirrorKey(repo, fx.upstream), fx.upstream)).rejects.toThrow(
      /off/,
    );
  });
});
