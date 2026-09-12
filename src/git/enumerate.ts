/**
 * Enumerates what a push introduces, from the quarantine: commits (parsed
 * from `git cat-file --batch`), an annotated tag when the ref is a tag
 * pointing at one, and the full introduced object list with types and
 * sizes. This is the content the policy contract's submission view exposes.
 */

import { CommitSummary, ObjectFormat, RefUpdate, TagSummary } from '../domain';
import { parseCommit, parseTag } from './objects';
import { Quarantine } from './quarantine';
import { git } from './run';

export interface IntroducedContent {
  commits: CommitSummary[];
  tag?: TagSummary;
  objects: Array<{ oid: string; type: 'commit' | 'tree' | 'blob' | 'tag'; size: number }>;
}

/** Objects reachable from the new tip and not already held: all refs for a creation, the old tip otherwise. */
export function rangeArgs(update: RefUpdate): string[] {
  return /^0+$/.test(update.oldOid)
    ? [update.newOid, '--not', '--all']
    : [update.newOid, `^${update.oldOid}`];
}

export async function enumerateIntroduced(
  q: Quarantine,
  update: RefUpdate,
  format: ObjectFormat,
): Promise<IntroducedContent> {
  const env = { ...q.env(), GIT_DIR: q.mirror.path };
  const cwd = q.mirror.path;
  if (/^0+$/.test(update.newOid)) return { commits: [], objects: [] }; // deletion introduces nothing

  const listed = (await git(['rev-list', '--objects', ...rangeArgs(update)], { cwd, env }))
    .toString()
    .split('\n')
    .filter(Boolean)
    .map((l) => l.split(' ')[0]);

  const meta = (
    await git(['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'], {
      cwd,
      env,
      input: Buffer.from(listed.join('\n') + '\n'),
    })
  )
    .toString()
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const [oid, type, size] = l.split(' ');
      return {
        oid,
        type: type as IntroducedContent['objects'][number]['type'],
        size: Number(size),
      };
    });

  const commitOids = meta.filter((o) => o.type === 'commit').map((o) => o.oid);
  const commits = await readObjects(cwd, env, commitOids, (oid, raw) =>
    parseCommit(oid, raw, format),
  );

  let tag: TagSummary | undefined;
  if (update.ref.startsWith('refs/tags/')) {
    const type = (await git(['cat-file', '-t', update.newOid], { cwd, env })).toString().trim();
    if (type === 'tag') {
      [tag] = await readObjects(cwd, env, [update.newOid], (oid, raw) =>
        parseTag(oid, raw, format),
      );
    }
  }
  return { commits, tag, objects: meta };
}

/** Reads objects with one `cat-file --batch` process and parses each body. */
async function readObjects<T>(
  cwd: string,
  env: Record<string, string>,
  oids: string[],
  parse: (oid: string, raw: Uint8Array) => T,
): Promise<T[]> {
  if (!oids.length) return [];
  const out = await git(['cat-file', '--batch'], {
    cwd,
    env,
    input: Buffer.from(oids.join('\n') + '\n'),
  });
  const results: T[] = [];
  let offset = 0;
  while (offset < out.length) {
    const nl = out.indexOf('\n', offset);
    const [oid, , sizeText] = out.toString('utf8', offset, nl).split(' ');
    const size = Number(sizeText);
    const body = out.subarray(nl + 1, nl + 1 + size);
    results.push(parse(oid, body));
    offset = nl + 1 + size + 1;
  }
  return results;
}
