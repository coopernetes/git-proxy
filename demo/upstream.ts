/**
 * Demo upstream: a bare repository served over smart HTTP by `git http-backend`
 * run as CGI from a bare `node:http` server. Stands in for a hosting platform
 * so the proxy has a real HTTP upstream to relay fetches to and push to.
 *
 * Env: UPSTREAM_PORT, UPSTREAM_ROOT (directory holding <owner>/<name>.git).
 */

import { spawn } from 'node:child_process';
import http from 'node:http';
import { pipeline } from 'node:stream/promises';

const PORT = Number(process.env.UPSTREAM_PORT ?? 8009);
const ROOT = process.env.UPSTREAM_ROOT ?? './.demo/upstream';

http
  .createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const cgi = spawn('git', ['http-backend'], {
      env: {
        ...process.env,
        GIT_PROJECT_ROOT: ROOT,
        GIT_HTTP_EXPORT_ALL: '1',
        REQUEST_METHOD: req.method ?? 'GET',
        PATH_INFO: url.pathname,
        QUERY_STRING: url.searchParams.toString(),
        CONTENT_TYPE: req.headers['content-type'] ?? '',
        CONTENT_LENGTH: req.headers['content-length'] ?? '',
        HTTP_CONTENT_ENCODING: req.headers['content-encoding'] ?? '',
        GIT_PROTOCOL: (req.headers['git-protocol'] as string) ?? '',
        REMOTE_USER: 'demo-upstream',
        REMOTE_ADDR: req.socket.remoteAddress ?? '',
      },
    });
    pipeline(req, cgi.stdin).catch(() => cgi.kill());

    // CGI output: header lines, blank line, body. Parse the head, stream the rest.
    let head = Buffer.alloc(0);
    let headerDone = false;
    cgi.stdout.on('data', (chunk: Buffer) => {
      if (headerDone) return void res.write(chunk);
      head = Buffer.concat([head, chunk]);
      const end = head.indexOf('\r\n\r\n');
      if (end < 0) return;
      headerDone = true;
      let status = 200;
      for (const line of head.subarray(0, end).toString().split('\r\n')) {
        const [k, v] = line.split(/:\s*/, 2);
        if (k.toLowerCase() === 'status') status = parseInt(v, 10);
        else res.setHeader(k, v);
      }
      res.writeHead(status);
      res.write(head.subarray(end + 4));
    });
    cgi.stdout.on('end', () => res.end());
    cgi.stderr.on('data', (d: Buffer) => process.stderr.write(`[http-backend] ${d}`));
  })
  .listen(PORT, () => console.log(`demo upstream (git http-backend) on ${PORT}, root ${ROOT}`));
