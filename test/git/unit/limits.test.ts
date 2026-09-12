import { describe, expect, it } from 'vitest';
import { bounded, LimitExceededError } from '../../../src/git/limits';

async function* chunks(...parts: number[]): AsyncIterable<Uint8Array> {
  for (const n of parts) yield Buffer.alloc(n, 1);
}

describe('bounded', () => {
  it('yields chunks up to the ceiling and throws at the first byte past it', async () => {
    const seen: number[] = [];
    const err = await (async () => {
      for await (const c of bounded(chunks(4, 4, 1), 8)) seen.push(c.length);
    })().catch((e) => e);
    expect(seen).toEqual([4, 4]);
    expect(err).toBeInstanceOf(LimitExceededError);
    expect(err.limit).toBe('maxRequestBodyBytes');
    expect(err.observed).toBe(9);
    expect(err.ceiling).toBe(8);
  });

  it('names the limit it was asked to enforce', async () => {
    const err = await (async () => {
      for await (const _ of bounded(chunks(2), 1, 'maxPktLineLength')) void _;
    })().catch((e) => e);
    expect(err.limit).toBe('maxPktLineLength');
  });
});
