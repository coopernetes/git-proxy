/**
 * pkt-line framing, the one piece of wire format the proxy parses itself.
 * The reader is bounded on line count and line length and never buffers
 * past the flush packet that ends the command section; whatever follows is
 * handed on untouched as the pack. Ref names and object ids are validated
 * before any of them names anything.
 */

import { ObjectFormat, RefUpdate } from '../domain';
import { LimitExceededError, ParseLimits } from './limits';

export type { ObjectFormat };

export type PktLine = { type: 'data'; payload: Uint8Array } | { type: 'flush' } | { type: 'delim' };

export interface PktLineReader {
  /** Yields packets up to and including the first flush; stops there. */
  lines(): AsyncIterable<PktLine>;
  /** Everything after the point where lines() stopped, including unread buffered bytes. */
  remainder(): AsyncIterable<Uint8Array>;
}

export interface PktLineWriter {
  data(payload: Uint8Array | string): void;
  flush(): void;
  delim(): void;
  band(band: 1 | 2 | 3, payload: Uint8Array | string): void;
}

export interface ReceivePackCommands {
  updates: [RefUpdate];
  capabilities: string[];
  objectFormat: ObjectFormat;
  /** The client asked for push-options; the proxy refuses the capability, so this is recorded and rejected. */
  pushOptionsAttempted: boolean;
}

export class ProtocolError extends Error {}

const FLUSH = Buffer.from('0000');
const DELIM = Buffer.from('0001');

export const encodePkt = (payload: Uint8Array | string): Buffer => {
  const data = typeof payload === 'string' ? Buffer.from(payload, 'utf8') : Buffer.from(payload);
  if (data.length + 4 > 65_520) throw new ProtocolError('pkt-line payload too long');
  return Buffer.concat([Buffer.from((data.length + 4).toString(16).padStart(4, '0')), data]);
};

export function createReader(
  source: AsyncIterable<Uint8Array>,
  limits: ParseLimits,
): PktLineReader {
  const iterator = source[Symbol.asyncIterator]();
  let buffer = Buffer.alloc(0);
  let done = false;
  let stopped = false;
  let count = 0;

  const fill = async (need: number): Promise<boolean> => {
    while (buffer.length < need && !done) {
      const { value, done: d } = await iterator.next();
      if (d) done = true;
      else buffer = Buffer.concat([buffer, Buffer.from(value)]);
    }
    return buffer.length >= need;
  };

  return {
    async *lines() {
      if (stopped) throw new ProtocolError('command section already consumed');
      for (;;) {
        if (!(await fill(4))) throw new ProtocolError('truncated pkt-line');
        const len = parseInt(buffer.subarray(0, 4).toString('ascii'), 16);
        if (Number.isNaN(len)) throw new ProtocolError('malformed pkt-line length');
        if (++count > limits.maxPktLineCount)
          throw new LimitExceededError('maxPktLineCount', count, limits.maxPktLineCount);
        if (len === 0) {
          buffer = buffer.subarray(4);
          stopped = true;
          yield { type: 'flush' };
          return;
        }
        if (len === 1) {
          buffer = buffer.subarray(4);
          yield { type: 'delim' };
          continue;
        }
        if (len < 4) throw new ProtocolError('malformed pkt-line length');
        if (len > limits.maxPktLineLength)
          throw new LimitExceededError('maxPktLineLength', len, limits.maxPktLineLength);
        if (!(await fill(len))) throw new ProtocolError('truncated pkt-line');
        const payload = buffer.subarray(4, len);
        buffer = buffer.subarray(len);
        yield { type: 'data', payload };
      }
    },
    async *remainder() {
      if (buffer.length) {
        const b = buffer;
        buffer = Buffer.alloc(0);
        yield b;
      }
      while (!done) {
        const { value, done: d } = await iterator.next();
        if (d) break;
        yield value;
      }
      done = true;
    },
  };
}

export function createWriter(sink: (chunk: Uint8Array) => void): PktLineWriter {
  return {
    data: (p) => sink(encodePkt(p)),
    flush: () => sink(FLUSH),
    delim: () => sink(DELIM),
    band: (band, p) => {
      const data = typeof p === 'string' ? Buffer.from(p, 'utf8') : Buffer.from(p);
      // Sideband packets carry at most 65515 payload bytes after the band byte.
      for (let i = 0; i < data.length || i === 0; i += 65_515) {
        sink(encodePkt(Buffer.concat([Buffer.from([band]), data.subarray(i, i + 65_515)])));
        if (data.length === 0) break;
      }
    },
  };
}

const ZERO = /^0+$/;

/** git check-ref-format rules for a full ref name, applied without a subprocess. */
export function isValidRefName(ref: string): boolean {
  if (!ref.startsWith('refs/') || ref.endsWith('/') || ref.endsWith('.')) return false;
  if (ref.includes('..') || ref.includes('@{') || ref.includes('//') || ref === '@') return false;
  if (/[\x00-\x20\x7f~^:?*[\\]/.test(ref)) return false;
  return ref.split('/').every((c) => c.length > 0 && !c.startsWith('.') && !c.endsWith('.lock'));
}

export function isValidObjectId(oid: string, format: ObjectFormat): boolean {
  return format === 'sha256' ? /^[0-9a-f]{64}$/.test(oid) : /^[0-9a-f]{40}$/.test(oid);
}

/**
 * Parses `old new ref[\0caps]` lines up to the flush. Exactly one ref update
 * is accepted. The object format comes from the capability list, else from
 * the id length.
 */
export async function parseReceivePackCommands(
  reader: PktLineReader,
  limits: ParseLimits,
): Promise<ReceivePackCommands> {
  const updates: RefUpdate[] = [];
  let capabilities: string[] = [];
  let sawFlush = false;
  for await (const line of reader.lines()) {
    if (line.type === 'flush') {
      sawFlush = true;
      break;
    }
    if (line.type === 'delim') throw new ProtocolError('unexpected delimiter in command section');
    let text = Buffer.from(line.payload).toString('utf8');
    if (text.endsWith('\n')) text = text.slice(0, -1);
    const nul = text.indexOf('\0');
    if (nul >= 0) {
      if (updates.length) throw new ProtocolError('capabilities may only follow the first command');
      capabilities = text
        .slice(nul + 1)
        .split(' ')
        .filter(Boolean);
      text = text.slice(0, nul);
    }
    const parts = text.split(' ');
    if (parts.length !== 3) throw new ProtocolError('malformed ref update line');
    const [oldOid, newOid, ref] = parts;
    const format: ObjectFormat =
      capabilities.find((c) => c.startsWith('object-format='))?.slice('object-format='.length) ===
      'sha256'
        ? 'sha256'
        : oldOid.length === 64
          ? 'sha256'
          : 'sha1';
    if (!isValidObjectId(oldOid, format) || !isValidObjectId(newOid, format))
      throw new ProtocolError('object id is not hex of the expected length');
    if (ZERO.test(oldOid) && ZERO.test(newOid)) throw new ProtocolError('empty ref update');
    if (!isValidRefName(ref)) throw new ProtocolError('invalid ref name');
    updates.push({ ref, oldOid, newOid });
    if (updates.length > limits.maxRefUpdates)
      throw new LimitExceededError('maxRefUpdates', updates.length, limits.maxRefUpdates);
  }
  if (!sawFlush) throw new ProtocolError('command section not terminated');
  if (updates.length !== 1) throw new ProtocolError('a push updates exactly one ref');
  const objectFormat: ObjectFormat = updates[0].oldOid.length === 64 ? 'sha256' : 'sha1';
  return {
    updates: [updates[0]],
    capabilities,
    objectFormat,
    pushOptionsAttempted: capabilities.includes('push-options'),
  };
}

/** Report-status body: `unpack ok` then one line per ref, then flush. */
export function encodeReportStatus(
  results: Array<{ ref: string; ok: true } | { ref: string; ok: false; reason: string }>,
  unpackOk = true,
): Buffer {
  return Buffer.concat([
    encodePkt(unpackOk ? 'unpack ok\n' : 'unpack index-pack failed\n'),
    ...results.map((r) =>
      encodePkt(r.ok ? `ok ${r.ref}\n` : `ng ${r.ref} ${r.reason.replace(/\n/g, ' ')}\n`),
    ),
    FLUSH,
  ]);
}
