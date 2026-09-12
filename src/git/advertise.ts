/**
 * Ref advertisement for server mode, produced by git from the mirror and
 * then filtered through the capability table. The advertisement's
 * capability list is on the first ref line after a NUL.
 */

import { GitService, serverAdvertisement } from './capabilities';
import { encodePkt } from './pktline';
import { git } from './run';

/** The complete smart-HTTP advertisement body for `info/refs?service=<service>`. */
export async function advertiseRefs(mirrorDir: string, service: GitService): Promise<Buffer> {
  const raw = await git([service.replace(/^git-/, ''), '--advertise-refs', mirrorDir]);
  return Buffer.concat([
    encodePkt(`# service=${service}\n`),
    Buffer.from('0000'),
    filterCapabilities(raw, service),
  ]);
}

/** Rewrites the capability list on the first ref line; every other byte is passed through. */
export function filterCapabilities(advertisement: Buffer, service: GitService): Buffer {
  const len = parseInt(advertisement.subarray(0, 4).toString('ascii'), 16);
  if (!len || len < 4) return advertisement;
  const first = advertisement.subarray(4, len).toString('utf8');
  const nul = first.indexOf('\0');
  if (nul < 0) return advertisement;
  const caps = first
    .slice(nul + 1)
    .trim()
    .split(' ')
    .filter(Boolean);
  const kept = serverAdvertisement(service, caps);
  const rewritten = `${first.slice(0, nul)}\0${kept.join(' ')}\n`;
  return Buffer.concat([encodePkt(rewritten.replace(/\n\n$/, '\n')), advertisement.subarray(len)]);
}
