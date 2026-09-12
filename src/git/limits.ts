/**
 * Parse limits. Every ceiling is checked before the proxy allocates for the
 * thing being limited, and pack inflation happens inside git on disk rather
 * than in proxy memory. Exceeding a limit fails closed with a readable
 * client error.
 */

export interface ParseLimits {
  /** Compressed request body ceiling, also passed to git as the pack input size. */
  maxRequestBodyBytes: number;
  maxPktLineCount: number;
  /** Includes the four length bytes; the protocol maximum is 65520. */
  maxPktLineLength: number;
  maxPackObjectCount: number;
  maxInflatedBytesPerObject: number;
  maxTotalInflatedBytes: number;
  /** Total inflated bytes divided by compressed pack bytes. */
  maxInflateRatio: number;
  maxRefUpdates: 1;
  maxDeltaChainDepth: number;
}

export const DEFAULT_LIMITS: ParseLimits = {
  maxRequestBodyBytes: 64 * 1024 * 1024,
  maxPktLineCount: 1024,
  maxPktLineLength: 65_520,
  maxPackObjectCount: 100_000,
  maxInflatedBytesPerObject: 128 * 1024 * 1024,
  maxTotalInflatedBytes: 512 * 1024 * 1024,
  maxInflateRatio: 100,
  maxRefUpdates: 1,
  maxDeltaChainDepth: 50,
};

export class LimitExceededError extends Error {
  constructor(
    readonly limit: keyof ParseLimits,
    readonly observed: number,
    readonly ceiling: number,
  ) {
    super(`${limit} exceeded: ${observed} > ${ceiling}`);
  }
}

/** Wraps a byte source so that reading past the ceiling throws before the excess is buffered. */
export async function* bounded(
  source: AsyncIterable<Uint8Array>,
  ceiling: number,
  limit: keyof ParseLimits = 'maxRequestBodyBytes',
): AsyncIterable<Uint8Array> {
  let total = 0;
  for await (const chunk of source) {
    total += chunk.length;
    if (total > ceiling) throw new LimitExceededError(limit, total, ceiling);
    yield chunk;
  }
}
