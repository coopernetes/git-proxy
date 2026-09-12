/**
 * Commit and tag object parsing from the raw object body as `git cat-file`
 * returns it. The proxy parses these two object types only, after git has
 * already validated them during admission; blobs and trees are never
 * interpreted here.
 */

import { CommitSummary, ObjectFormat, TagSummary } from '../domain';

export interface PersonLine {
  name: string;
  email: string;
  timestamp: number;
  tzOffset: string;
}

export class ObjectParseError extends Error {}

/** `Name <email> 1700000000 +0100` */
export function parsePersonLine(line: string): PersonLine {
  const m = line.match(/^(.*?) <([^>]*)> (\d+) ([+-]\d{4})$/);
  if (!m) throw new ObjectParseError(`malformed person line: ${line}`);
  return { name: m[1], email: m[2], timestamp: Number(m[3]), tzOffset: m[4] };
}

interface ParsedHeaders {
  headers: Array<[key: string, value: string]>;
  message: string;
}

/** Splits headers from the message; continuation lines (leading space) belong to the previous header. */
function splitObject(raw: Uint8Array): ParsedHeaders {
  const text = Buffer.from(raw).toString('utf8');
  const end = text.indexOf('\n\n');
  const head = end < 0 ? text : text.slice(0, end);
  const message = end < 0 ? '' : text.slice(end + 2);
  const headers: Array<[string, string]> = [];
  for (const line of head.split('\n')) {
    if (line.startsWith(' ') && headers.length) {
      headers[headers.length - 1][1] += '\n' + line.slice(1);
      continue;
    }
    const sp = line.indexOf(' ');
    if (sp < 0) throw new ObjectParseError(`malformed header line: ${line}`);
    headers.push([line.slice(0, sp), line.slice(sp + 1)]);
  }
  return { headers, message };
}

const oidLength = (format: ObjectFormat) => (format === 'sha256' ? 64 : 40);

export function parseCommit(oid: string, raw: Uint8Array, format: ObjectFormat): CommitSummary {
  const { headers, message } = splitObject(raw);
  const get = (k: string) => headers.filter(([h]) => h === k).map(([, v]) => v);
  const [tree] = get('tree');
  if (!tree || tree.length !== oidLength(format))
    throw new ObjectParseError('commit without a valid tree');
  const [author] = get('author');
  const [committer] = get('committer');
  if (!author || !committer) throw new ObjectParseError('commit without author or committer');
  const a = parsePersonLine(author);
  const c = parsePersonLine(committer);
  const signature = get('gpgsig')[0] ?? get('gpgsig-sha256')[0];
  return {
    oid,
    parents: get('parent'),
    author: { name: a.name, email: a.email, timestamp: a.timestamp },
    committer: { name: c.name, email: c.email, timestamp: c.timestamp },
    message,
    signature,
    trailers: extractTrailers(message),
  };
}

export function parseTag(oid: string, raw: Uint8Array, format: ObjectFormat): TagSummary {
  const { headers, message } = splitObject(raw);
  const get = (k: string) => headers.find(([h]) => h === k)?.[1];
  const targetOid = get('object');
  const targetType = get('type') as TagSummary['targetType'] | undefined;
  const name = get('tag');
  if (!targetOid || targetOid.length !== oidLength(format) || !targetType || !name)
    throw new ObjectParseError('malformed tag object');
  const taggerLine = get('tagger');
  const tagger = taggerLine ? parsePersonLine(taggerLine) : undefined;
  // A tag signature is appended to the message rather than carried in a header.
  const sigStart = message.indexOf('-----BEGIN ');
  return {
    oid,
    name,
    targetOid,
    targetType,
    tagger: tagger && { name: tagger.name, email: tagger.email, timestamp: tagger.timestamp },
    message: sigStart >= 0 ? message.slice(0, sigStart) : message,
    signature: sigStart >= 0 ? message.slice(sigStart) : undefined,
  };
}

/** Trailers are `Key: value` lines in the final paragraph of the message, as git interpret-trailers reads them. */
export function extractTrailers(message: string): Record<string, string[]> {
  const paragraphs = message.replace(/\n+$/, '').split(/\n\s*\n/);
  const last = paragraphs[paragraphs.length - 1] ?? '';
  const lines = last.split('\n');
  const out: Record<string, string[]> = {};
  const trailer = /^([A-Za-z][A-Za-z0-9-]*)\s*:\s*(.*)$/;
  if (!lines.every((l) => trailer.test(l) || /^\s/.test(l))) return out;
  if (paragraphs.length === 1 && lines.length === 1) return out; // a one-line message is not a trailer block
  for (const l of lines) {
    const m = l.match(trailer);
    if (m) (out[m[1]] ??= []).push(m[2]);
  }
  return out;
}

/** The signature block from a commit's headers, when present. */
export function extractSignature(rawHeaders: string): string | undefined {
  // No multiline flag: `$` must mean end of input, or a lazy match stops at the first line break.
  const m = rawHeaders.match(/(?:^|\n)gpgsig(?:-sha256)? ([\s\S]*?)(?=\n[^ ]|$)/);
  return m ? m[1].replace(/\n /g, '\n') : undefined;
}
