/**
 * Per-push quarantine: a private object directory with the mirror as an
 * alternate. Objects the client pushed exist only here until the push is
 * forwarded; a rejected push is discarded by removing the directory. Paths
 * are derived only from the assigned push id, which is validated as an
 * opaque token before it touches the filesystem.
 */

import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { MirrorEntry } from './mirror';
import { quarantineEnv } from './pack';
import { git } from './run';

export interface Quarantine {
  readonly pushId: string;
  readonly objectDir: string;
  readonly mirror: MirrorEntry;
  /** Environment for git and for external scanners: quarantine as the object dir, mirror as the alternate. */
  env(): Record<string, string>;
  discard(): Promise<void>;
}

export interface QuarantineStore {
  create(pushId: string, mirror: MirrorEntry): Promise<Quarantine>;
  /**
   * Every object in the admitted pack must be reachable from the new tip
   * and not from what the mirror already holds (or from the old tip for an
   * update). Objects outside that set would enter the repository without
   * passing content inspection.
   */
  verifyComplete(
    quarantine: Quarantine,
    update: { oldOid: string; newOid: string },
  ): Promise<{ complete: boolean; unreachable: string[] }>;
}

const ID = /^[A-Za-z0-9_-]{6,64}$/;

export function createQuarantineStore(root: string): QuarantineStore {
  return {
    async create(pushId, mirror) {
      if (!ID.test(pushId)) throw new Error('push id is not an opaque token');
      const objectDir = path.join(root, pushId);
      await mkdir(path.join(objectDir, 'pack'), { recursive: true });
      return {
        pushId,
        objectDir,
        mirror,
        env: () => quarantineEnv(objectDir, mirror.path),
        discard: () => rm(objectDir, { recursive: true, force: true }),
      };
    },
    async verifyComplete(q, update) {
      const env = { ...q.env(), GIT_DIR: q.mirror.path };
      const zero = /^0+$/.test(update.oldOid);
      // No admitted pack (a deletion, or an empty push) has nothing to verify.
      const idx = await readFile(path.join(q.objectDir, 'pack', 'push.idx')).catch(() => undefined);
      if (!idx) return { complete: true, unreachable: [] };
      const packed = await git(['show-index'], { input: idx });
      const inPack = new Set(
        packed
          .toString()
          .split('\n')
          .filter(Boolean)
          .map((l) => l.split(' ')[1]),
      );
      if (inPack.size === 0) return { complete: true, unreachable: [] };
      const args = zero
        ? ['rev-list', '--objects', update.newOid, '--not', '--all']
        : ['rev-list', '--objects', update.newOid, `^${update.oldOid}`];
      const reachable = new Set(
        (await git(args, { cwd: q.mirror.path, env }))
          .toString()
          .split('\n')
          .filter(Boolean)
          .map((l) => l.split(' ')[0]),
      );
      const unreachable = [...inPack].filter((oid) => !reachable.has(oid));
      return { complete: unreachable.length === 0, unreachable };
    },
  };
}
