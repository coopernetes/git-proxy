/**
 * Asynchronous git subprocess runner. Never blocks the event loop, bounds
 * captured output, supports a streamed stdin and an abort signal. Every
 * other module in this directory reaches git through it.
 */

import { spawn } from 'node:child_process';

export interface RunOptions {
  cwd?: string;
  env?: Record<string, string | undefined>;
  input?: AsyncIterable<Uint8Array> | Uint8Array;
  /** Bytes of stdout to retain; more is discarded and reported. */
  maxOutputBytes?: number;
  abort?: AbortSignal;
  /** Receives stdout chunks as they arrive instead of buffering them. */
  onStdout?: (chunk: Buffer) => void;
}

export interface RunResult {
  code: number;
  stdout: Buffer;
  stderr: string;
  truncated: boolean;
}

export class GitError extends Error {
  constructor(
    readonly args: string[],
    readonly code: number,
    readonly stderr: string,
  ) {
    super(`git ${args[0]} exited ${code}: ${stderr.trim().split('\n').slice(-1)[0] ?? ''}`);
  }
}

/** Runs git with a clean environment: only the variables passed in plus PATH and HOME. */
export function run(args: string[], options: RunOptions = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, {
      cwd: options.cwd,
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        GIT_TERMINAL_PROMPT: '0',
        LC_ALL: 'C',
        ...options.env,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      signal: options.abort,
    });
    const max = options.maxOutputBytes ?? 16 * 1024 * 1024;
    const out: Buffer[] = [];
    let outSize = 0;
    let truncated = false;
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
      if (options.onStdout) return options.onStdout(chunk);
      if (outSize + chunk.length > max) {
        truncated = true;
        return;
      }
      out.push(chunk);
      outSize += chunk.length;
    });
    child.stderr.on('data', (chunk: Buffer) => {
      if (stderr.length < 64 * 1024) stderr += chunk.toString('utf8');
    });
    child.on('error', reject);
    child.on('close', (code) =>
      resolve({ code: code ?? -1, stdout: Buffer.concat(out), stderr, truncated }),
    );
    const feed = async () => {
      const input = options.input;
      if (!input) return child.stdin.end();
      if (input instanceof Uint8Array) return child.stdin.end(input);
      for await (const chunk of input) {
        if (!child.stdin.write(chunk)) await new Promise((r) => child.stdin.once('drain', r));
      }
      child.stdin.end();
    };
    feed().catch((e) => {
      child.kill();
      reject(e);
    });
    child.stdin.on('error', () => {
      /* consumer exited early; close reports the code */
    });
  });
}

/** Runs git and throws GitError on a non-zero exit. */
export async function git(args: string[], options: RunOptions = {}): Promise<Buffer> {
  const r = await run(args, options);
  if (r.code !== 0) throw new GitError(args, r.code, r.stderr);
  return r.stdout;
}
