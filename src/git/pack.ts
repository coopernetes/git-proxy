/**
 * Pack admission. The pack bytes stream from the client into
 * `git index-pack --stdin --fix-thin --strict` with the quarantine as the
 * object directory and the mirror as an alternate, so thin packs resolve
 * and nothing lands in the mirror. Git inflates to disk; the proxy never
 * holds an inflated object. Ceilings: the compressed input size (checked
 * while streaming and again by git), the object count from the pack
 * header, and after admission the per-object and total inflated sizes and
 * the inflate ratio, computed from git's own object metadata.
 */

import { createHash } from 'node:crypto';
import { LimitExceededError, ParseLimits } from './limits';
import { GitError, git, run } from './run';

export interface PackSummary {
  objectCount: number;
  /** SHA-256 of the compressed pack as received. */
  digest: string;
  compressedBytes: number;
  inflatedBytes: number;
  largestObjectBytes: number;
}

export interface PackAdmission {
  admit(options: {
    source: AsyncIterable<Uint8Array>;
    /** The quarantine object directory. */
    objectDir: string;
    /** The mirror's git directory; its objects are an alternate. */
    mirrorDir: string;
    limits: ParseLimits;
    abort?: AbortSignal;
  }): Promise<PackSummary>;
}

export class PackRejectedError extends Error {}

export function readPackHeader(
  header: Uint8Array,
  limits: ParseLimits,
): { version: 2 | 3; objectCount: number } {
  const b = Buffer.from(header);
  if (b.length < 12 || b.toString('ascii', 0, 4) !== 'PACK')
    throw new PackRejectedError('missing PACK signature');
  const version = b.readUInt32BE(4);
  if (version !== 2 && version !== 3)
    throw new PackRejectedError(`unsupported pack version ${version}`);
  const objectCount = b.readUInt32BE(8);
  if (objectCount > limits.maxPackObjectCount)
    throw new LimitExceededError('maxPackObjectCount', objectCount, limits.maxPackObjectCount);
  return { version, objectCount };
}

export function quarantineEnv(objectDir: string, mirrorDir: string): Record<string, string> {
  return {
    GIT_OBJECT_DIRECTORY: objectDir,
    GIT_ALTERNATE_OBJECT_DIRECTORIES: `${mirrorDir}/objects`,
  };
}

export function createPackAdmission(): PackAdmission {
  return {
    async admit({ source, objectDir, mirrorDir, limits, abort }) {
      const hash = createHash('sha256');
      let compressed = 0;
      let headerChecked = false;
      let head = Buffer.alloc(0);

      // Tee the stream: count, hash and check the header while git consumes it.
      async function* tee(): AsyncIterable<Uint8Array> {
        for await (const chunk of source) {
          compressed += chunk.length;
          if (compressed > limits.maxRequestBodyBytes)
            throw new LimitExceededError(
              'maxRequestBodyBytes',
              compressed,
              limits.maxRequestBodyBytes,
            );
          hash.update(chunk);
          if (!headerChecked) {
            head = Buffer.concat([head, Buffer.from(chunk)]);
            if (head.length >= 12) {
              readPackHeader(head, limits);
              headerChecked = true;
            }
          }
          yield chunk;
        }
        if (compressed === 0) return; // an empty pack (ref deletion) sends no bytes
        if (!headerChecked) throw new PackRejectedError('pack shorter than its header');
      }

      const env = quarantineEnv(objectDir, mirrorDir);
      const packFile = `${objectDir}/pack/push.pack`;
      let objectCount = 0;
      try {
        const source2 = tee();
        // Peek: if the client sent no pack at all there is nothing to admit.
        const first = await source2[Symbol.asyncIterator]().next();
        if (first.done) {
          return {
            objectCount: 0,
            digest: hash.digest('hex'),
            compressedBytes: 0,
            inflatedBytes: 0,
            largestObjectBytes: 0,
          };
        }
        async function* rest(): AsyncIterable<Uint8Array> {
          yield first.value;
          yield* source2;
        }
        await git(
          [
            'index-pack',
            '--stdin',
            '--fix-thin',
            '--strict',
            `--max-input-size=${limits.maxRequestBodyBytes}`,
            packFile,
          ],
          { cwd: mirrorDir, env: { ...env, GIT_DIR: mirrorDir }, input: rest(), abort },
        );
        objectCount = head.readUInt32BE(8);
      } catch (e) {
        if (e instanceof GitError)
          throw new PackRejectedError(`index-pack refused the pack: ${e.stderr.trim()}`);
        throw e;
      }

      // Inflated sizes from git's metadata for every object in the quarantine pack.
      const idx = await git(['show-index'], {
        input: await readFile(`${objectDir}/pack/push.idx`),
      });
      const oids = idx
        .toString()
        .split('\n')
        .filter(Boolean)
        .map((l) => l.split(' ')[1]);
      const meta = await run(['cat-file', '--batch-check=%(objectname) %(objectsize)'], {
        cwd: mirrorDir,
        env: { ...env, GIT_DIR: mirrorDir },
        input: Buffer.from(oids.join('\n') + '\n'),
      });
      let inflated = 0;
      let largest = 0;
      for (const line of meta.stdout.toString().split('\n')) {
        const size = Number(line.split(' ')[1]);
        if (!Number.isFinite(size)) continue;
        inflated += size;
        largest = Math.max(largest, size);
      }
      if (largest > limits.maxInflatedBytesPerObject)
        throw new LimitExceededError(
          'maxInflatedBytesPerObject',
          largest,
          limits.maxInflatedBytesPerObject,
        );
      if (inflated > limits.maxTotalInflatedBytes)
        throw new LimitExceededError(
          'maxTotalInflatedBytes',
          inflated,
          limits.maxTotalInflatedBytes,
        );
      if (compressed > 0 && inflated / compressed > limits.maxInflateRatio)
        throw new LimitExceededError(
          'maxInflateRatio',
          Math.round(inflated / compressed),
          limits.maxInflateRatio,
        );

      return {
        objectCount,
        digest: hash.digest('hex'),
        compressedBytes: compressed,
        inflatedBytes: inflated,
        largestObjectBytes: largest,
      };
    },
  };
}

async function readFile(path: string): Promise<Buffer> {
  const { readFile } = await import('node:fs/promises');
  return readFile(path);
}
