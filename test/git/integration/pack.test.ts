import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_LIMITS, LimitExceededError } from '../../../src/git/limits';
import { PackRejectedError, createPackAdmission, readPackHeader } from '../../../src/git/pack';
import { Fixture, chunks, commit, empty, makeFixture, packFor } from './helpers';

let fx: Fixture;
let n = 0;
const objectDir = () => {
  const d = path.join(fx.root, 'q', String(++n));
  mkdirSync(path.join(d, 'pack'), { recursive: true });
  return d;
};

beforeAll(() => {
  fx = makeFixture();
});
afterAll(() => fx.cleanup());

describe('readPackHeader', () => {
  const header = (count: number, version = 2) => {
    const b = Buffer.alloc(12);
    b.write('PACK', 0, 'ascii');
    b.writeUInt32BE(version, 4);
    b.writeUInt32BE(count, 8);
    return b;
  };
  it('reads version and count', () => {
    expect(readPackHeader(header(7), DEFAULT_LIMITS)).toEqual({ version: 2, objectCount: 7 });
  });
  it('rejects a bad signature', () => {
    expect(() => readPackHeader(Buffer.from('NOPE00000000'), DEFAULT_LIMITS)).toThrow(
      PackRejectedError,
    );
  });
  it('rejects an unknown version', () => {
    expect(() => readPackHeader(header(1, 9), DEFAULT_LIMITS)).toThrow(PackRejectedError);
  });
  it('rejects a short header', () => {
    expect(() => readPackHeader(Buffer.from('PACK'), DEFAULT_LIMITS)).toThrow(PackRejectedError);
  });
  it('rejects an object count over the limit before anything is inflated', () => {
    expect(() => readPackHeader(header(1_000_000), DEFAULT_LIMITS)).toThrow(LimitExceededError);
  });
});

describe('createPackAdmission', () => {
  it('admits a thin pack into the quarantine and summarises it', async () => {
    const newOid = commit(fx.clone, 'a.txt', 'a\n', 'feat: a');
    const pack = packFor(fx.clone, fx.seed, newOid);
    const summary = await createPackAdmission().admit({
      source: chunks(pack, 100),
      objectDir: objectDir(),
      mirrorDir: fx.mirror,
      limits: DEFAULT_LIMITS,
    });
    expect(summary.objectCount).toBe(3); // commit, tree, blob
    expect(summary.digest).toBe(createHash('sha256').update(pack).digest('hex'));
    expect(summary.compressedBytes).toBe(pack.length);
    expect(summary.inflatedBytes).toBeGreaterThan(0);
    expect(summary.largestObjectBytes).toBeGreaterThan(0);
  });

  it('returns an empty summary for an empty source', async () => {
    const summary = await createPackAdmission().admit({
      source: empty(),
      objectDir: objectDir(),
      mirrorDir: fx.mirror,
      limits: DEFAULT_LIMITS,
    });
    expect(summary.objectCount).toBe(0);
    expect(summary.compressedBytes).toBe(0);
  });

  it('rejects a header declaring too many objects before git runs', async () => {
    const b = Buffer.alloc(12);
    b.write('PACK', 0, 'ascii');
    b.writeUInt32BE(2, 4);
    b.writeUInt32BE(50, 8);
    await expect(
      createPackAdmission().admit({
        source: chunks(b),
        objectDir: objectDir(),
        mirrorDir: fx.mirror,
        limits: { ...DEFAULT_LIMITS, maxPackObjectCount: 10 },
      }),
    ).rejects.toBeInstanceOf(LimitExceededError);
  });

  it('rejects a body over maxRequestBodyBytes while streaming', async () => {
    const newOid = commit(fx.clone, 'b.txt', 'b\n', 'feat: b');
    const pack = packFor(fx.clone, fx.seed, newOid);
    await expect(
      createPackAdmission().admit({
        source: chunks(pack, 64),
        objectDir: objectDir(),
        mirrorDir: fx.mirror,
        limits: { ...DEFAULT_LIMITS, maxRequestBodyBytes: pack.length - 1 },
      }),
    ).rejects.toMatchObject({ limit: 'maxRequestBodyBytes' });
  });

  it('rejects an object larger than maxInflatedBytesPerObject after admission', async () => {
    const big = 'x'.repeat(1024 * 1024);
    const newOid = commit(fx.clone, 'big.bin', big, 'feat: big');
    const pack = packFor(fx.clone, fx.seed, newOid);
    await expect(
      createPackAdmission().admit({
        source: chunks(pack),
        objectDir: objectDir(),
        mirrorDir: fx.mirror,
        limits: { ...DEFAULT_LIMITS, maxInflatedBytesPerObject: 512 * 1024 },
      }),
    ).rejects.toMatchObject({ limit: 'maxInflatedBytesPerObject' });
  });

  it('rejects an inflate ratio over the ceiling', async () => {
    const newOid = commit(fx.clone, 'zeros.bin', '\0'.repeat(2 * 1024 * 1024), 'feat: zeros');
    const pack = packFor(fx.clone, fx.seed, newOid);
    await expect(
      createPackAdmission().admit({
        source: chunks(pack),
        objectDir: objectDir(),
        mirrorDir: fx.mirror,
        limits: { ...DEFAULT_LIMITS, maxInflateRatio: 2 },
      }),
    ).rejects.toMatchObject({ limit: 'maxInflateRatio' });
  });

  it('rejects a corrupt pack', async () => {
    const newOid = commit(fx.clone, 'c.txt', 'c\n', 'feat: c');
    const pack = Buffer.from(packFor(fx.clone, fx.seed, newOid));
    for (let i = 20; i < Math.min(pack.length, 60); i++) pack[i] ^= 0xff;
    await expect(
      createPackAdmission().admit({
        source: chunks(pack),
        objectDir: objectDir(),
        mirrorDir: fx.mirror,
        limits: DEFAULT_LIMITS,
      }),
    ).rejects.toBeInstanceOf(PackRejectedError);
  });
});
