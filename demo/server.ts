/**
 * Copyright 2026 GitProxy Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Demo server: one bare `node:http` process serving the smart-HTTP receive
 * side, a streaming fetch relay to the upstream, a tiny review API and both
 * deferral models. No web framework, no proxy middleware: routing is a
 * switch on the path, bodies are read as streams under a byte cap, and the
 * upstream leg is Node's built-in `fetch` (undici) with a streamed body.
 * Runs the real contracts with mock checks. Not production code.
 *
 * Env: PORT, MIRROR (bare mirror dir), PROVIDERS (host=baseUrl pairs, e.g.
 * github.com=https://github.com), MODE (relay | server),
 * REVIEW_WINDOW_SECONDS, DATA (scratch dir).
 */

import http from 'node:http';
import { Readable } from 'node:stream';
import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { CommitSummary, PushRecord, PushState, RefUpdate } from '../src/domain';
import { DemoSubmission, evaluate } from './checks';
import {
  DEFAULT_LIMITS,
  LimitExceededError,
  PackRejectedError,
  ProtocolError,
  advertiseRefs,
  bounded,
  createForwarder,
  createPackAdmission,
  createQuarantineStore,
  createReader,
  createWriter,
  encodeReportStatus,
  enumerateIntroduced,
  parseReceivePackCommands,
  refusedCapabilities,
} from '../src/git';
import type { MirrorEntry, Quarantine, RefResult } from '../src/git';

const PORT = Number(process.env.PORT ?? 8008);
const MIRROR = path.resolve(process.env.MIRROR ?? './.demo/mirror.git');
/** Upstream hosts the proxy fronts, keyed by the hostname that appears in the client URL: `/git/<host>/<path>.git`. */
const PROVIDERS: Record<string, string> = Object.fromEntries(
  (process.env.PROVIDERS ?? 'localhost=http://localhost:8009')
    .split(',')
    .map((p) => p.split('=') as [string, string]),
);
/** `local`: the static table below. `github`: the token is resolved to a login through the platform's identity API. */
const IDENTITY = (process.env.IDENTITY ?? 'local') as 'local' | 'github';
/** Logins allowed to push when identity comes from the platform; the store would hold grants instead. */
const REGISTERED_LOGINS = (process.env.REGISTERED_LOGINS ?? '').split(',').filter(Boolean);
const REVIEWERS = (process.env.REVIEWERS ?? 'bob,alice').split(',').filter(Boolean);
const MODE = (process.env.MODE ?? 'relay') as 'relay' | 'server';
const REVIEW_WINDOW = Number(process.env.REVIEW_WINDOW_SECONDS ?? 30);
const DATA = path.resolve(process.env.DATA ?? './.demo/data');
const API_URL = process.env.API_URL ?? 'https://api.github.com';

/** Users as the store would hold them: credential → identity, never a name the client typed. */
const USERS: Record<string, { username: string; emails: string[]; capabilities: string[] }> = {
  'alice-token': {
    username: 'alice',
    emails: ['alice@example.com'],
    capabilities: ['push', 'review'],
  },
  'bob-token': { username: 'bob', emails: ['bob@example.com'], capabilities: ['push', 'review'] },
};

type Record_ = PushRecord & { lines: string[]; quarantine: Quarantine };
const pushes = new Map<string, Record_>();
const audit: Array<{
  pushId: string;
  from: PushState | null;
  to: PushState;
  at: string;
  trigger: string;
  actor?: string;
}> = [];

const transition = (r: Record_, to: PushState, trigger: string, actor?: string) => {
  audit.push({ pushId: r.id, from: r.state, to, at: new Date().toISOString(), trigger, actor });
  r.state = to;
};

type Pusher = { presented: string; username: string; emails: string[]; capabilities: string[] };
/** Token digest → resolved identity; bounded TTL cache so the identity API is not called per request. */
const identityCache = new Map<string, { at: number; pusher: Pusher | undefined }>();

/**
 * Credential-anchored resolution. The presented username is recorded and
 * ignored; the token decides. With `github`, the token is presented to the
 * platform's identity API and the returned login is the identity. The token
 * itself is never stored: only its digest keys the cache.
 */
const resolvePusher = async (header?: string): Promise<Pusher | undefined> => {
  if (!header?.startsWith('Basic ')) return undefined;
  const [presented, token] = Buffer.from(header.slice(6), 'base64').toString().split(':');
  if (IDENTITY === 'local') {
    const user = USERS[token];
    return user ? { presented, ...user } : undefined;
  }
  const digest = createHash('sha256').update(token).digest('hex');
  const cached = identityCache.get(digest);
  if (cached && Date.now() - cached.at < 60_000) return cached.pusher;
  const r = await fetch(`${API_URL}/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'gitproxy-v3-demo',
      Accept: 'application/vnd.github+json',
    },
  });
  let pusher: Pusher | undefined;
  if (r.ok) {
    const u = (await r.json()) as { login: string; email?: string | null };
    pusher = {
      presented,
      username: u.login,
      emails: u.email ? [u.email] : [],
      capabilities: REGISTERED_LOGINS.includes(u.login) ? ['push'] : [],
    };
  }
  identityCache.set(digest, { at: Date.now(), pusher });
  return pusher;
};

type Req = http.IncomingMessage;
type Res = http.ServerResponse;

/** Reads a request body under the byte cap. Over the cap: 413 and the socket is destroyed, nothing buffered further. */
const readBody = async (req: Req, cap: number): Promise<Buffer | undefined> => {
  // Used by the JSON API only; git bodies are streamed, never buffered.
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > cap) return undefined;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

const json = (res: Res, status: number, body: unknown) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};

const unauthorized = (res: Res) => {
  res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="gitproxy"' });
  res.end();
};

const reviewUrl = (id: string) => `http://localhost:${PORT}/api/v1/pushes/${id}`;

/**
 * Fetch relay: the request body streams to the upstream and the upstream
 * response streams back, status and headers relayed as they are. Hop-by-hop
 * headers are dropped; the client's credential is not forwarded because the
 * demo upstream is unauthenticated (a real relay forwards it unchanged).
 */
const relayFetch = async (req: Req, res: Res, upstreamUrl: string) => {
  const url = new URL(upstreamUrl);
  const headers: Record<string, string> = {};
  // The client's credential is relayed unchanged; the proxy read it for identity and does not rewrite it.
  for (const h of [
    'authorization',
    'content-type',
    'content-encoding',
    'git-protocol',
    'accept',
    'user-agent',
  ]) {
    const v = req.headers[h];
    if (typeof v === 'string') headers[h] = v;
  }
  const upstream = await fetch(url, {
    method: req.method,
    headers,
    body: req.method === 'POST' ? (Readable.toWeb(req) as ReadableStream) : undefined,
    // @ts-expect-error: half-duplex streaming request body, supported by Node's fetch
    duplex: 'half',
  });
  const out: Record<string, string> = {};
  upstream.headers.forEach((v, k) => {
    if (!['transfer-encoding', 'connection', 'content-length'].includes(k)) out[k] = v;
  });
  res.writeHead(upstream.status, out);
  if (upstream.body) await Readable.fromWeb(upstream.body as never).pipe(res);
  else res.end();
};

const LIMITS = DEFAULT_LIMITS;
const mirrorEntry = (repo: PushRecord['repository']): MirrorEntry => ({
  key: { repository: repo, upstreamUrlDigest: 'demo' },
  path: MIRROR,
});
const quarantines = createQuarantineStore(path.join(DATA, 'quarantine'));
const admission = createPackAdmission();
const forwarder = createForwarder();

/** Sideband and report-status over the response. Band 2 is progress, band 1 carries report-status. */
const sideband = (res: Res, enabled: boolean) => {
  const w = createWriter((chunk) => res.write(chunk));
  return {
    progress: (line: string) => enabled && w.band(2, line + '\n'),
    reportStatus: (results: RefResult[]) =>
      enabled ? w.band(1, encodeReportStatus(results)) : res.write(encodeReportStatus(results)),
    end: () => {
      if (enabled) w.flush();
      res.end();
    },
  };
};

const receivePack = async (
  req: Req,
  res: Res,
  repo: PushRecord['repository'],
  upstreamUrl: string,
) => {
  const pusher = await resolvePusher(req.headers.authorization);
  if (!pusher) return unauthorized(res);
  const credential = req.headers.authorization
    ? ({ kind: 'client-relayed', header: req.headers.authorization } as const)
    : ({ kind: 'none' } as const);

  // 1. Command section, bounded, before anything is allocated for the pack.
  const reader = createReader(
    bounded(req as AsyncIterable<Uint8Array>, LIMITS.maxRequestBodyBytes),
    LIMITS,
  );
  let commands;
  try {
    commands = await parseReceivePackCommands(reader, LIMITS);
  } catch (e) {
    const message =
      e instanceof ProtocolError || e instanceof LimitExceededError ? e.message : 'bad request';
    res.writeHead(400).end(message);
    return req.socket.destroy();
  }
  const update = commands.updates[0];
  res.writeHead(200, {
    'Content-Type': 'application/x-git-receive-pack-result',
    'Cache-Control': 'no-cache',
  });
  const sb = sideband(res, commands.capabilities.includes('side-band-64k'));
  const refused = refusedCapabilities('git-receive-pack', commands.capabilities);
  if (refused.length) {
    sb.reportStatus([
      { ref: update.ref, ok: false, reason: `capability not accepted: ${refused.join(' ')}` },
    ]);
    return sb.end();
  }
  if (!pusher.capabilities.includes('push')) {
    sb.reportStatus([
      {
        ref: update.ref,
        ok: false,
        reason: `${pusher.username} holds no push grant on ${repo.owner}/${repo.name}`,
      },
    ]);
    return sb.end();
  }

  // Relay mode retry: consume an approval bound to repository, ref, old and new.
  const approved = [...pushes.values()].find(
    (p) =>
      p.state === 'approved' &&
      !p.approvalConsumedAt &&
      p.repository.owner === repo.owner &&
      p.repository.name === repo.name &&
      p.refUpdate.ref === update.ref &&
      p.refUpdate.oldOid === update.oldOid &&
      p.refUpdate.newOid === update.newOid,
  );

  // 2. Record with an assigned id; the quarantine path derives from that id only.
  const id = 'p_' + randomBytes(6).toString('hex');
  const quarantine = await quarantines.create(id, mirrorEntry(repo));
  const record: Record_ = {
    id,
    state: 'received',
    receivedAt: new Date().toISOString(),
    repository: repo,
    refUpdate: update,
    transport: 'https',
    mode: MODE,
    pusher: {
      anchor: { kind: 'token', providerId: repo.providerId, digest: 'demo' },
      presented: pusher.presented,
      resolved: { providerId: repo.providerId, login: pusher.username },
      userId: pusher.username,
      assurance: 'confirmed',
    },
    commits: [],
    steps: [],
    lines: [],
    quarantine,
  };
  pushes.set(id, record);
  audit.push({
    pushId: id,
    from: null,
    to: 'received',
    at: record.receivedAt,
    trigger: 'submission accepted',
  });
  const say = (l: string) => {
    record.lines.push(l);
    sb.progress(l);
  };
  const fail = async (state: 'error' | 'rejected', trigger: string, reason: string) => {
    transition(record, state, trigger);
    sb.reportStatus([{ ref: update.ref, ok: false, reason: `${reason} (${id})` }]);
    sb.end();
    await quarantine.discard();
  };

  say(`gitproxy: push ${id} received for ${repo.owner}/${repo.name} ${update.ref} (${MODE} mode)`);
  say(
    `gitproxy: pusher ${pusher.username} resolved from token (presented name "${pusher.presented}" ignored)`,
  );

  // 3. Pack admission streams into the quarantine; git inflates to disk under the ceilings.
  try {
    record.packDigest = (
      await admission.admit({
        source: reader.remainder(),
        objectDir: quarantine.objectDir,
        mirrorDir: MIRROR,
        limits: LIMITS,
      })
    ).digest;
  } catch (e) {
    const reason =
      e instanceof LimitExceededError || e instanceof PackRejectedError
        ? e.message
        : 'pack admission failed';
    record.errorCause = reason;
    return fail('error', 'pack admission failed', reason);
  }
  transition(record, 'processing', 'evaluation begins');

  // 4. Completeness: every admitted object must be reachable from the ref update.
  const completeness = await quarantines.verifyComplete(quarantine, update);
  if (!completeness.complete) {
    say(
      `gitproxy: ${completeness.unreachable.length} object(s) in the pack are not reachable from ${update.ref}`,
    );
    record.rejection = {
      actorType: 'automated',
      timestamp: new Date().toISOString(),
      reason: 'pack contains objects not reachable from the ref update',
    };
    return fail('rejected', 'hard policy violation', 'pack contains unreachable objects');
  }

  // 5. Enrichment from the quarantine, then the decision host.
  const content = await enumerateIntroduced(quarantine, update, commands.objectFormat);
  record.commits = content.commits;
  record.tag = content.tag;
  const submission: DemoSubmission = {
    id,
    ref: update.ref,
    oldOid: update.oldOid,
    newOid: update.newOid,
    pusher,
    commits: content.commits,
    objectCount: content.objects.length,
  };
  const evaluation = await evaluate(submission, say);
  record.steps = evaluation.steps;
  record.summary = evaluation.summary;

  if (evaluation.outcome === 'rejected') {
    record.rejection = {
      actorType: 'automated',
      timestamp: new Date().toISOString(),
      reason: evaluation.summary,
    };
    say(`gitproxy: rejected — ${evaluation.summary}`);
    return fail('rejected', 'hard policy violation', evaluation.summary);
  }

  // 6. Forwarding reads objects from the quarantine and relays the client's credential to one child process.
  const forward = async (r: Record_) => {
    try {
      const result = await forwarder.forward({
        quarantine: r.quarantine,
        upstreamUrl,
        update: r.refUpdate,
        credential,
      });
      for (const m of result.upstreamMessages) say(`upstream: ${m}`);
      const ok = result.refs.every((x) => x.ok);
      if (ok) {
        r.forwardedAt = new Date().toISOString();
        transition(r, 'forwarded', 'upstream accepted');
        say(`gitproxy: forwarded to upstream as ${pusher.username}`);
      } else {
        r.errorCause = result.refs.map((x) => (x.ok ? '' : x.reason)).join('; ');
        transition(r, 'error', 'upstream refused');
      }
      sb.reportStatus(
        result.refs.length
          ? result.refs
          : [{ ref: update.ref, ok: false, reason: 'no result from upstream' }],
      );
    } catch (e) {
      r.errorCause = String(e);
      transition(r, 'error', 'forwarding failed');
      sb.reportStatus([{ ref: r.refUpdate.ref, ok: false, reason: `forwarding failed (${r.id})` }]);
    }
    sb.end();
    await r.quarantine.discard();
  };

  if (approved) {
    approved.approvalConsumedAt = new Date().toISOString();
    record.consumedApprovalId = approved.id;
    record.approval = approved.approval;
    transition(record, 'pending', 'hard checks passed');
    transition(
      record,
      'approved',
      `consumed approval ${approved.id} bound to ${update.ref} ${update.oldOid.slice(0, 8)}..${update.newOid.slice(0, 8)}`,
    );
    say(
      `gitproxy: approval ${approved.id} by ${approved.approval?.actor?.username} matches this repository, ref and range; consumed`,
    );
    return forward(record);
  }

  transition(record, 'pending', 'hard checks passed');
  if (MODE === 'relay') {
    say(`gitproxy: awaiting review — ${reviewUrl(id)}`);
    say(
      `gitproxy: push again after approval; the approval is bound to ${update.ref} ${update.oldOid.slice(0, 8)}..${update.newOid.slice(0, 8)}`,
    );
    sb.reportStatus([
      { ref: update.ref, ok: false, reason: `review required: ${id} ${reviewUrl(id)}` },
    ]);
    sb.end();
    return quarantine.discard(); // relay mode does not retain the pack
  }

  // Server mode: hold the connection, heartbeat, forward on approval on this same connection.
  say(
    `gitproxy: awaiting review — ${reviewUrl(id)} (holding connection, window ${REVIEW_WINDOW}s)`,
  );
  const started = Date.now();
  let gone = false;
  req.on('close', () => {
    gone = true;
  });
  while (record.state === 'pending') {
    await new Promise((r) => setTimeout(r, 1000));
    const elapsed = Math.round((Date.now() - started) / 1000);
    if (gone) {
      record.cancellation = {
        actorType: 'automated',
        timestamp: new Date().toISOString(),
        reason: 'client disconnected while pending',
      };
      transition(record, 'canceled', 'client disconnect');
      return quarantine.discard();
    }
    if (elapsed >= REVIEW_WINDOW) {
      record.cancellation = {
        actorType: 'automated',
        timestamp: new Date().toISOString(),
        reason: `review window of ${REVIEW_WINDOW}s expired`,
      };
      transition(record, 'canceled', 'review window expiry');
      sb.reportStatus([{ ref: update.ref, ok: false, reason: `review window expired (${id})` }]);
      sb.end();
      return quarantine.discard();
    }
    if (elapsed % 2 === 0)
      sb.progress(
        `gitproxy: awaiting review… (${elapsed}s elapsed, ${REVIEW_WINDOW - elapsed}s remaining)`,
      );
  }
  if (record.state === 'approved') return forward(record);
  sb.reportStatus([
    { ref: update.ref, ok: false, reason: `${record.rejection?.reason ?? 'rejected'} (${id})` },
  ]);
  sb.end();
  await quarantine.discard();
};

const api = async (req: Req, res: Res, url: URL) => {
  const m = url.pathname.match(/^\/api\/v1\/pushes(?:\/([^/]+))?(?:\/(approve|reject))?$/);
  if (url.pathname === '/api/v1/audit' && req.method === 'GET') return json(res, 200, audit);
  if (!m) return json(res, 404, { message: 'not found' });
  const [, id, decision] = m;
  const strip = ({ lines: _l, quarantine: _q, ...r }: Record_) => r;
  if (!id && req.method === 'GET') return json(res, 200, [...pushes.values()].map(strip));
  const r = id ? pushes.get(id) : undefined;
  if (!r) return json(res, 404, { message: 'no such push' });
  if (!decision && req.method === 'GET')
    return json(res, 200, { ...strip(r), audit: audit.filter((a) => a.pushId === r.id) });
  if (!decision || req.method !== 'POST') return json(res, 405, { message: 'method not allowed' });
  const reviewer = String(req.headers['x-reviewer'] ?? '');
  if (!REVIEWERS.includes(reviewer))
    return json(res, 403, { message: `${reviewer || 'anonymous'} holds no review grant` });
  if (r.state !== 'pending') return json(res, 409, { message: `push is ${r.state}` });
  if (r.pusher.userId === reviewer)
    return json(res, 403, {
      message: 'the pusher cannot approve their own push without a self-certify grant',
    });
  const raw = await readBody(req, 64 * 1024);
  const reason = raw?.length
    ? (JSON.parse(raw.toString()) as { reason?: string }).reason
    : undefined;
  const attestation = {
    actorType: 'human' as const,
    actor: { userId: reviewer, username: reviewer },
    timestamp: new Date().toISOString(),
    reason,
  };
  if (decision === 'approve') {
    r.approval = attestation;
    transition(r, 'approved', 'reviewer decision', reviewer);
  } else {
    r.rejection = { ...attestation, reason: reason ?? 'rejected by reviewer' };
    transition(r, 'rejected', 'reviewer decision', reviewer);
  }
  json(res, 200, { id: r.id, state: r.state });
};

/** `/git/<host>/<path>.git/<endpoint>`: the same shape as the upstream URL with the host moved into the path. */
/** `/git/<host>/<path>.git/<endpoint>`: the same shape as the upstream URL with the host moved into the path. */
const GIT_PATH = /^\/git\/([^/]+)\/(.+)\.git\/(info\/refs|git-upload-pack|git-receive-pack)$/;

http
  .createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    try {
      if (url.pathname.startsWith('/api/')) return await api(req, res, url);
      const m = url.pathname.match(GIT_PATH);
      if (!m) return void res.writeHead(404).end();
      const [, host, repoPath, endpoint] = m;
      const base = PROVIDERS[host];
      // An unknown host is refused before anything is parsed.
      if (!base) return void res.writeHead(404).end(`no provider configured for ${host}`);
      const segments = repoPath.split('/');
      const repo = {
        providerId: host,
        host,
        owner: segments.slice(0, -1).join('/'),
        name: segments[segments.length - 1],
      };
      const upstreamUrl = `${base}/${repoPath}.git`;
      if (!(await resolvePusher(req.headers.authorization))) return unauthorized(res);
      const service = url.searchParams.get('service');
      if (endpoint === 'info/refs' && service === 'git-receive-pack') {
        // Server mode advertises the mirror's refs through the capability table.
        res.writeHead(200, {
          'Content-Type': 'application/x-git-receive-pack-advertisement',
          'Cache-Control': 'no-cache',
        });
        return void res.end(await advertiseRefs(MIRROR, 'git-receive-pack'));
      }
      if (endpoint === 'git-receive-pack') return await receivePack(req, res, repo, upstreamUrl);
      // Fetches relay to the upstream, streamed both ways.
      return await relayFetch(req, res, `${upstreamUrl}/${endpoint}${url.search}`);
    } catch (e) {
      console.error(e);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    }
  })
  .listen(PORT, () =>
    console.log(
      `demo gitproxy on ${PORT} (${MODE} mode), mirror ${MIRROR}, providers ${Object.keys(PROVIDERS).join(' ')}`,
    ),
  );
