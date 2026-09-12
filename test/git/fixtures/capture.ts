/**
 * Regenerates the binary fixtures: real `git push` request bodies captured
 * off the wire, plus a bundle of the repository state they were pushed
 * against so a test can rebuild the mirror and admit them.
 *
 *   npx tsx test/git/fixtures/capture.ts
 *
 * Produces, next to this file:
 *   seed.bundle        the upstream before either push (rebuild with `git clone seed.bundle x.git --mirror`)
 *   push-update.bin    body of a push that advances main by one commit (thin pack, needs the seed as bases)
 *   push-create.bin    body of a push that creates refs/heads/feature from main (thin pack as well)
 *   push-tag.bin       body of a push that creates an annotated tag
 *   push-two-refs.bin  body of a push updating two refs at once (must be refused)
 * Timestamps and identities are fixed so the object ids are stable.
 */

import { execFileSync, spawn } from 'node:child_process';
import http from 'node:http';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const here = __dirname;
const work = mkdtempSync(path.join(tmpdir(), 'capture-'));
const env = {
  ...process.env,
  GIT_AUTHOR_NAME: 'Fixture',
  GIT_AUTHOR_EMAIL: 'fixture@example.com',
  GIT_COMMITTER_NAME: 'Fixture',
  GIT_COMMITTER_EMAIL: 'fixture@example.com',
  GIT_AUTHOR_DATE: '2026-01-01T00:00:00Z',
  GIT_COMMITTER_DATE: '2026-01-01T00:00:00Z',
};
const sh = (args: string[], cwd = work) =>
  execFileSync('git', args, { cwd, env, stdio: ['ignore', 'pipe', 'inherit'] });

const upstream = path.join(work, 'upstream.git');
sh(['init', '-q', '--bare', '-b', 'main', upstream]);
const clone = path.join(work, 'clone');
sh(['clone', '-q', upstream, clone]);
writeFileSync(path.join(clone, 'README'), 'seed\n');
sh(['add', 'README'], clone);
sh(['commit', '-qm', 'seed'], clone);
sh(['push', '-q', 'origin', 'main'], clone);
sh(['bundle', 'create', path.join(here, 'seed.bundle'), '--all'], upstream);

let captured: Buffer | undefined;
const server = http.createServer((req, res) => {
  if (req.method === 'GET') {
    const adv = sh(['receive-pack', '--advertise-refs', upstream]);
    res.writeHead(200, { 'Content-Type': 'application/x-git-receive-pack-advertisement' });
    res.end(Buffer.concat([Buffer.from('001f# service=git-receive-pack\n0000'), adv]));
    return;
  }
  const chunks: Buffer[] = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    captured = Buffer.concat(chunks);
    // Report everything as rejected so the upstream never changes between captures.
    const ng = (ref: string) => `ng ${ref} captured\n`;
    const refs = captured.toString('latin1').match(/refs\/[^\0\n ]+/g) ?? [];
    const pkt = (l: string | Buffer) => {
      const b = Buffer.isBuffer(l) ? l : Buffer.from(l);
      return Buffer.concat([Buffer.from((b.length + 4).toString(16).padStart(4, '0')), b]);
    };
    const status = Buffer.concat([
      pkt('unpack ok\n'),
      ...refs.map((r) => pkt(ng(r))),
      Buffer.from('0000'),
    ]);
    // The client negotiated side-band-64k, so report-status travels on band 1.
    const body = Buffer.concat([
      pkt(Buffer.concat([Buffer.from([1]), status])),
      Buffer.from('0000'),
    ]);
    res.writeHead(200, { 'Content-Type': 'application/x-git-receive-pack-result' });
    res.end(body);
  });
});
async function main() {
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as { port: number }).port;
  const proxy = `http://localhost:${port}/repo.git`;

  const capture = async (name: string, refspec: string[]) => {
    captured = undefined;
    // Asynchronous: a synchronous child would block the event loop the fake server runs on.
    await new Promise<void>((resolve) => {
      const child = spawn('git', ['push', '-q', proxy, ...refspec], {
        cwd: clone,
        env,
        stdio: 'ignore',
      });
      child.on('close', () => resolve());
    });
    if (!captured) throw new Error(`nothing captured for ${name}`);
    writeFileSync(path.join(here, name), captured);
    console.log(`${name}: ${captured.length} bytes`);
  };

  writeFileSync(path.join(clone, 'a.txt'), 'first change\n');
  sh(['add', 'a.txt'], clone);
  sh(['commit', '-qm', 'feat: first change'], clone);
  await capture('push-update.bin', ['main:refs/heads/main']);
  await capture('push-create.bin', ['main:refs/heads/feature']);
  sh(['tag', '-a', 'v1', '-m', 'release v1'], clone);
  await capture('push-tag.bin', ['refs/tags/v1:refs/tags/v1']);
  await capture('push-two-refs.bin', ['main:refs/heads/main', 'main:refs/heads/feature']);

  server.close();
  rmSync(work, { recursive: true, force: true });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
