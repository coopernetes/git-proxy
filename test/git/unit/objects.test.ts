import { describe, expect, it } from 'vitest';
import {
  extractSignature,
  extractTrailers,
  ObjectParseError,
  parseCommit,
  parsePersonLine,
  parseTag,
} from '../../../src/git/objects';

const T = 't'.repeat(40);
const P1 = '1'.repeat(40);
const P2 = '2'.repeat(40);

describe('parsePersonLine', () => {
  it('parses name, email, timestamp and offset', () => {
    expect(parsePersonLine('Alice Example <alice@example.com> 1700000000 +0100')).toEqual({
      name: 'Alice Example',
      email: 'alice@example.com',
      timestamp: 1700000000,
      tzOffset: '+0100',
    });
  });
  it('throws on a malformed line', () => {
    expect(() => parsePersonLine('nope')).toThrow(ObjectParseError);
  });
});

describe('parseCommit', () => {
  const body = [
    `tree ${T}`,
    `parent ${P1}`,
    `parent ${P2}`,
    'author Alice <alice@example.com> 1700000000 +0000',
    'committer Bob <bob@example.com> 1700000001 +0000',
    'gpgsig -----BEGIN PGP SIGNATURE-----',
    ' ',
    ' abc123',
    ' -----END PGP SIGNATURE-----',
    '',
    'feat: add thing',
    '',
    'Signed-off-by: Alice <alice@example.com>',
    '',
  ].join('\n');

  it('parses parents, people, message, signature and trailers', () => {
    const c = parseCommit('c'.repeat(40), Buffer.from(body), 'sha1');
    expect(c.parents).toEqual([P1, P2]);
    expect(c.author).toEqual({ name: 'Alice', email: 'alice@example.com', timestamp: 1700000000 });
    expect(c.committer.email).toBe('bob@example.com');
    expect(c.message).toBe('feat: add thing\n\nSigned-off-by: Alice <alice@example.com>\n');
    expect(c.signature).toBe(
      '-----BEGIN PGP SIGNATURE-----\n\nabc123\n-----END PGP SIGNATURE-----',
    );
    expect(c.trailers).toEqual({ 'Signed-off-by': ['Alice <alice@example.com>'] });
  });

  it('rejects a commit whose tree does not match the object format', () => {
    expect(() => parseCommit('c'.repeat(40), Buffer.from(body), 'sha256')).toThrow(
      ObjectParseError,
    );
  });

  it('rejects a commit without a committer', () => {
    const noCommitter = body.replace(/^committer .*\n/m, '');
    expect(() => parseCommit('c'.repeat(40), Buffer.from(noCommitter), 'sha1')).toThrow(
      ObjectParseError,
    );
  });
});

describe('parseTag', () => {
  const head = [
    `object ${P1}`,
    'type commit',
    'tag v1.0',
    'tagger Alice <alice@example.com> 1700000000 +0000',
    '',
    'Release 1.0\n',
  ].join('\n');

  it('parses an unsigned tag', () => {
    const t = parseTag('a'.repeat(40), Buffer.from(head), 'sha1');
    expect(t).toMatchObject({
      name: 'v1.0',
      targetOid: P1,
      targetType: 'commit',
      message: 'Release 1.0\n',
    });
    expect(t.tagger?.email).toBe('alice@example.com');
    expect(t.signature).toBeUndefined();
  });

  it('splits an appended signature block from the message', () => {
    const sig = '-----BEGIN PGP SIGNATURE-----\nxyz\n-----END PGP SIGNATURE-----\n';
    const t = parseTag('a'.repeat(40), Buffer.from(head + sig), 'sha1');
    expect(t.message).toBe('Release 1.0\n');
    expect(t.signature).toBe(sig);
  });

  it('rejects a tag without a target', () => {
    expect(() => parseTag('a'.repeat(40), Buffer.from('type commit\ntag x\n\nm'), 'sha1')).toThrow(
      ObjectParseError,
    );
  });
});

describe('extractTrailers', () => {
  it('collects repeated keys in the final paragraph', () => {
    const m =
      'subject\n\nbody\n\nSigned-off-by: A <a@x>\nSigned-off-by: B <b@x>\nCo-authored-by: C <c@x>\n';
    expect(extractTrailers(m)).toEqual({
      'Signed-off-by': ['A <a@x>', 'B <b@x>'],
      'Co-authored-by': ['C <c@x>'],
    });
  });
  it('yields nothing for a one-line message', () => {
    expect(extractTrailers('Fixes: everything')).toEqual({});
  });
  it('yields nothing when the last paragraph is not all trailers', () => {
    expect(extractTrailers('subject\n\nSigned-off-by: A <a@x>\nsome prose here\n')).toEqual({});
  });
});

describe('extractSignature', () => {
  it('returns the unindented gpgsig block from raw headers', () => {
    const raw = `tree ${T}\ngpgsig -----BEGIN\n line2\n -----END\ncommitter X <x@x> 1 +0000`;
    expect(extractSignature(raw)).toBe('-----BEGIN\nline2\n-----END');
  });
  it('returns undefined without one', () => {
    expect(extractSignature(`tree ${T}\nauthor X <x@x> 1 +0000`)).toBeUndefined();
  });
});
