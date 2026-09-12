import { describe, expect, it } from 'vitest';
import {
  createReader,
  createWriter,
  encodePkt,
  encodeReportStatus,
  isValidObjectId,
  isValidRefName,
  parseReceivePackCommands,
  ProtocolError,
} from '../../../src/git/pktline';
import { DEFAULT_LIMITS, LimitExceededError, ParseLimits } from '../../../src/git/limits';

const A = 'a'.repeat(40);
const B = 'b'.repeat(40);
const ZERO = '0'.repeat(40);

async function* chunks(...parts: Array<Buffer | string>): AsyncIterable<Uint8Array> {
  for (const p of parts) yield typeof p === 'string' ? Buffer.from(p) : p;
}

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const x of it) out.push(x);
  return out;
}

const text = (l: { type: string; payload?: Uint8Array }) =>
  l.type === 'data' ? Buffer.from(l.payload!).toString() : l.type;

describe('encodePkt', () => {
  it('prefixes the four-byte hex length including itself', () => {
    expect(encodePkt('abc').toString()).toBe('0007abc');
    expect(encodePkt(Buffer.alloc(0)).toString()).toBe('0004');
  });
  it('refuses payloads over the protocol maximum', () => {
    expect(() => encodePkt(Buffer.alloc(65_517))).toThrow(ProtocolError);
  });
});

describe('createReader', () => {
  it('reassembles packets split across chunk boundaries and stops at flush', async () => {
    const wire = Buffer.concat([encodePkt('hello\n'), encodePkt('world'), Buffer.from('0000')]);
    const reader = createReader(
      chunks(wire.subarray(0, 3), wire.subarray(3, 9), wire.subarray(9)),
      DEFAULT_LIMITS,
    );
    expect((await collect(reader.lines())).map(text)).toEqual(['hello\n', 'world', 'flush']);
  });

  it('yields delimiters', async () => {
    const wire = Buffer.concat([encodePkt('x'), Buffer.from('0001'), Buffer.from('0000')]);
    const reader = createReader(chunks(wire), DEFAULT_LIMITS);
    expect((await collect(reader.lines())).map(text)).toEqual(['x', 'delim', 'flush']);
  });

  it('throws ProtocolError on truncated input', async () => {
    const reader = createReader(chunks(encodePkt('hello').subarray(0, 6)), DEFAULT_LIMITS);
    await expect(collect(reader.lines())).rejects.toBeInstanceOf(ProtocolError);
  });

  it('enforces the line count limit', async () => {
    const limits: ParseLimits = { ...DEFAULT_LIMITS, maxPktLineCount: 2 };
    const wire = Buffer.concat([
      encodePkt('a'),
      encodePkt('b'),
      encodePkt('c'),
      Buffer.from('0000'),
    ]);
    const err = await collect(createReader(chunks(wire), limits).lines()).catch((e) => e);
    expect(err).toBeInstanceOf(LimitExceededError);
    expect(err.limit).toBe('maxPktLineCount');
  });

  it('enforces the line length limit before reading the payload', async () => {
    const limits: ParseLimits = { ...DEFAULT_LIMITS, maxPktLineLength: 10 };
    const err = await collect(createReader(chunks('0020'), limits).lines()).catch((e) => e);
    expect(err).toBeInstanceOf(LimitExceededError);
    expect(err.limit).toBe('maxPktLineLength');
  });

  it('remainder returns buffered leftover then the rest of the source', async () => {
    const wire = Buffer.concat([encodePkt('cmd'), Buffer.from('0000'), Buffer.from('PACKrest')]);
    const reader = createReader(chunks(wire, Buffer.from('more')), DEFAULT_LIMITS);
    await collect(reader.lines());
    const rest = Buffer.concat((await collect(reader.remainder())).map((c) => Buffer.from(c)));
    expect(rest.toString()).toBe('PACKrestmore');
  });
});

describe('createWriter', () => {
  const sink = () => {
    const out: Buffer[] = [];
    return { out, w: createWriter((c) => out.push(Buffer.from(c))) };
  };

  it('frames band packets with the band byte', () => {
    const { out, w } = sink();
    w.band(2, 'hi');
    expect(out[0]).toEqual(
      Buffer.concat([Buffer.from('0007'), Buffer.from([2]), Buffer.from('hi')]),
    );
  });

  it('splits a large band payload into protocol-sized packets', () => {
    const { out, w } = sink();
    w.band(1, Buffer.alloc(65_515 + 10, 1));
    expect(out).toHaveLength(2);
    expect(out[0].length).toBe(65_520);
    expect(out[1].length).toBe(4 + 1 + 10);
  });

  it('emits one packet for an empty band payload', () => {
    const { out, w } = sink();
    w.band(3, '');
    expect(out).toHaveLength(1);
    expect(out[0].toString('hex')).toBe(
      Buffer.concat([Buffer.from('0005'), Buffer.from([3])]).toString('hex'),
    );
  });

  it('writes flush and delim', () => {
    const { out, w } = sink();
    w.flush();
    w.delim();
    expect(out.map(String)).toEqual(['0000', '0001']);
  });
});

describe('parseReceivePackCommands', () => {
  const parse = (wire: Buffer, limits = DEFAULT_LIMITS) =>
    parseReceivePackCommands(createReader(chunks(wire), limits), limits);
  const cmd = (line: string) => encodePkt(line + '\n');
  const flush = Buffer.from('0000');

  it('parses one update with capabilities', async () => {
    const r = await parse(
      Buffer.concat([
        cmd(`${A} ${B} refs/heads/main\0report-status side-band-64k agent=git/2.54`),
        flush,
      ]),
    );
    expect(r.updates).toEqual([{ ref: 'refs/heads/main', oldOid: A, newOid: B }]);
    expect(r.capabilities).toEqual(['report-status', 'side-band-64k', 'agent=git/2.54']);
    expect(r.objectFormat).toBe('sha1');
    expect(r.pushOptionsAttempted).toBe(false);
  });

  it('detects sha256 via the object-format capability and via id length', async () => {
    const a = 'a'.repeat(64);
    const b = 'b'.repeat(64);
    const viaCap = await parse(
      Buffer.concat([cmd(`${a} ${b} refs/heads/x\0object-format=sha256`), flush]),
    );
    expect(viaCap.objectFormat).toBe('sha256');
    const viaLen = await parse(Buffer.concat([cmd(`${a} ${b} refs/heads/x`), flush]));
    expect(viaLen.objectFormat).toBe('sha256');
  });

  it('rejects invalid ref names and non-hex ids', async () => {
    await expect(
      parse(Buffer.concat([cmd(`${A} ${B} refs/heads/a..b`), flush])),
    ).rejects.toBeInstanceOf(ProtocolError);
    await expect(
      parse(Buffer.concat([cmd(`${A} ${'z'.repeat(40)} refs/heads/a`), flush])),
    ).rejects.toBeInstanceOf(ProtocolError);
    await expect(
      parse(Buffer.concat([cmd(`${A} ../../etc refs/heads/a`), flush])),
    ).rejects.toBeInstanceOf(ProtocolError);
  });

  it('refuses two updates with the maxRefUpdates limit', async () => {
    const err = await parse(
      Buffer.concat([cmd(`${A} ${B} refs/heads/a`), cmd(`${A} ${B} refs/heads/b`), flush]),
    ).catch((e) => e);
    expect(err).toBeInstanceOf(LimitExceededError);
    expect(err.limit).toBe('maxRefUpdates');
  });

  it('refuses an empty zero to zero update', async () => {
    await expect(
      parse(Buffer.concat([cmd(`${ZERO} ${ZERO} refs/heads/a`), flush])),
    ).rejects.toBeInstanceOf(ProtocolError);
  });

  it('refuses capabilities on a line other than the first', async () => {
    const wire = Buffer.concat([
      cmd(`${A} ${B} refs/heads/a`),
      cmd(`${A} ${B} refs/heads/b\0report-status`),
      flush,
    ]);
    await expect(parse(wire)).rejects.toThrow();
  });

  it('flags a push-options request', async () => {
    const r = await parse(
      Buffer.concat([cmd(`${A} ${B} refs/heads/a\0report-status push-options`), flush]),
    );
    expect(r.pushOptionsAttempted).toBe(true);
  });

  it('requires a flush to terminate the command section', async () => {
    await expect(parse(cmd(`${A} ${B} refs/heads/a`))).rejects.toBeInstanceOf(ProtocolError);
  });
});

describe('isValidRefName', () => {
  it.each([
    ['refs/heads/a', true],
    ['refs/heads/feature/x-1.2', true],
    ['refs/tags/v1.0', true],
    ['refs/heads/a..b', false],
    ['refs/heads/.a', false],
    ['refs/heads/a.lock', false],
    ['refs/heads/a/', false],
    ['refs/heads/a b', false],
    ['refs/heads/a~', false],
    ['refs/heads/a@{b}', false],
    ['refs/heads/a//b', false],
    ['refs/heads/a.', false],
    ['refs/heads/a\\b', false],
    ['HEAD', false],
    ['main', false],
  ])('%s -> %s', (ref, ok) => {
    expect(isValidRefName(ref)).toBe(ok);
  });
});

describe('isValidObjectId', () => {
  it('matches the format length', () => {
    expect(isValidObjectId(A, 'sha1')).toBe(true);
    expect(isValidObjectId(A, 'sha256')).toBe(false);
    expect(isValidObjectId('a'.repeat(64), 'sha256')).toBe(true);
    expect(isValidObjectId('A'.repeat(40), 'sha1')).toBe(false);
  });
});

describe('encodeReportStatus', () => {
  it('emits unpack ok, per-ref lines and a flush', () => {
    const out = encodeReportStatus([
      { ref: 'refs/heads/a', ok: true },
      { ref: 'refs/heads/b', ok: false, reason: 'review\nrequired' },
    ]);
    expect(out.toString()).toBe(
      '000eunpack ok\n0014ok refs/heads/a\n0024ng refs/heads/b review required\n0000',
    );
  });
  it('reports an unpack failure', () => {
    expect(encodeReportStatus([], false).toString()).toBe('001dunpack index-pack failed\n0000');
  });
});
