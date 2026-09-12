---
title: Git engine and transports
---

# Git engine and transports

Module: `src/git/*`, `src/proxy/*`. `src/git` is implemented and tested; `src/proxy` is declared.

## Tests

Three layers, split by what they need:

- Unit (`test/git/unit`, `npm run test:unit`): the pure modules, pkt-line framing, object parsing, capability tables, limits. No subprocess.
- Integration (`test/git/integration`, `npm run test:integration`): the git-backed modules against temporary repositories with a real `git`, plus a replay of captured `git push` request bodies from `test/git/fixtures` through the whole receive path. The fixtures are regenerated with `npm run fixtures:capture`, which records what a stock client sends to a fake receive endpoint and bundles the repository state it was pushed against.
- End to end: the demo (`npm run demo`), against a local upstream or github.com.

## One engine

The client URL is `https://<proxy>/git/<host>/<path>.git`: the upstream URL with its host moved into the path, the shape 2.x uses. A client changes only the scheme and host of its remote. The host must match a configured provider; an unknown host is refused before anything is parsed.

Both transports and both modes call one `PushEngine` and one `FetchEngine`. The transports differ only in how they build a `PushContext` and how they deliver messages back. The HTTP transport is the only place Express appears in the proxy. The SSH transport uses the public `ssh2` API and no private internals.

## Limits

`ParseLimits` bounds the request body, the number and length of pkt-lines, the number of pack objects, inflated bytes per object, total inflated bytes, the inflate ratio and the delta chain depth. Limits are checked before allocation. Exceeding a limit fails closed with a readable client error. The number of ref updates per push is fixed at one.

## Parsing

The command section of a receive-pack request is read by a bounded pkt-line reader. Ref names are validated against git's ref-name rules. Object ids are validated as hex of the negotiated object format's length. Both SHA-1 and SHA-256 formats are handled.

Pack data streams into `git index-pack --stdin --fix-thin --strict` with the quarantine as the object directory and the mirror as an alternate, under `--max-input-size` and a streaming byte ceiling. Git inflates to disk; the proxy never holds an inflated object. After admission the per-object and total inflated sizes and the inflate ratio are read from git's object metadata and checked against the limits. Thin packs resolve against the mirror and reachability is computed with `git rev-list`.

## Quarantine

In server mode the proxy runs `git receive-pack` on the mirror, which places incoming objects in git's native quarantine and runs the pre-receive hook before anything is promoted. A rejected push leaves nothing in the mirror.

In the relay mode the same effect comes from a temporary object directory with the mirror as an alternate. External scanners receive that directory through the alternate-object-directories environment variable so they see the pushed objects.

Quarantine paths are derived only from the assigned push record id.

## Mirror cache

The mirror cache is keyed by the canonical repository identity plus a digest of the full upstream URL, so two upstreams that sanitise to the same name never share a mirror. Clones of different repositories proceed in parallel; clones of the same repository are serialised by a per-key lock. Modes: shared, ephemeral, off.

## Reachability and object coverage

Every object in the pack must be reachable from the ref update's new tip and not from its old tip. A hidden or unreferenced object rejects the push. Where the reachable set cannot be computed the verdict is `could-not-run`, which fails closed. Annotated tag objects are inspected themselves: tagger, message, signature.

## Capability mediation

`src/git/capabilities.ts` holds a position table per service: `support`, `relay`, `strip` or `refuse`. In the relay mode the client-facing advertisement is a subset of the upstream's. In server mode the proxy advertises what it supports; connection-local capabilities (sideband, quiet, agent, ofs-delta, thin-pack transfer) may differ per hop, end-to-end capabilities (object-format, atomic, delete-refs, push-options, push-cert) are offered only when the upstream honours them.

Positions that close bypass channels: `packfile-uris` is stripped, `push-options` is refused, `push-cert` is stripped, `allow-tip-sha1-in-want` and `allow-reachable-sha1-in-want` are stripped unless authorization is reachability-based.

## Denial semantics

Proxy-originated denials are a 403 on HTTP and an equivalent readable refusal on SSH. After the git service has been dispatched a denial is delivered in the pkt-line body: `unpack ok` followed by `ng <ref> <reason>` on band 1 with detail on band 2. The reason the client sees is the string recorded on the record. Upstream responses are relayed unchanged; a 404 from the upstream is never turned into a 403 and never into a 200.

## Fetch path at scale

A policy gateway placed in front of an enterprise's hosting platform carries every fetch as well as every push, so the fetch path has to stay cheap. Three shapes exist, and the relay is the default.

**Relay.** The request streams to the upstream and the response streams back. The proxy holds a few buffers per connection and the upstream generates the packs. Cost scales with bandwidth. A fetch response is specific to the client's negotiation, so relayed responses cannot be cached.

**Serve from the mirror.** The proxy terminates the fetch and runs `git upload-pack --stateless-rpc` on a local mirror. Pack generation moves onto the proxy. This suits a metered or slow upstream and the read-only mirror deployment. Holding up under CI load needs: mirrors on local disk, a concurrency cap on git subprocesses so a burst queues instead of forking, a per-repository lock around refresh, bitmaps and a commit graph on the mirror so pack generation is cheap, and a cache in front of `pack-objects` through `uploadpack.packObjectsHook` so identical clones reuse one pack. Freshness is fetch-on-demand with a TTL or a webhook from the upstream. Large hosting platforms that moved off per-request `git http-backend` kept spawning git per request; what they added was disk locality, a spawn limiter and a pack cache.

**Bundle URIs.** A protocol v2 server can advertise a pre-built bundle that the client downloads over plain HTTP before negotiating the rest. For full clones this replaces pack generation with a static file from disk or a CDN. It depends on the protocol version not being downgraded through the proxy.

The skeleton keeps the second shape reachable without a redesign: `FetchEngine` is separate from the push engine, `MirrorCache` has shared and ephemeral modes, and the SSH transport falls back to serving from the mirror where agent forwarding is unavailable. Serving fetches from the mirror is a scoped feature on top of the relay.

## Forwarding

`Forwarder` pushes accepted objects from the mirror to the upstream. Credential strategies are `client-relayed` (the client's own credential for this request, in memory only) and `agent-forwarded` (SSH). There is no stored-credential strategy. The upstream's report-status is relayed verbatim.

## Sideband

`ProgressWriter` sends band-2 progress with heartbeats during evaluation and the held wait, and the deferral notice with the correlation id and review URL. `ReportStatusWriter` writes the per-ref result.

## SSH

Host keys are loaded from the configured path. Public-key authentication verifies the client's signature over the session identifier with the presented key before the fingerprint is looked up. The login name is ignored. Agent forwarding is the upstream credential. Port and X11 forwarding are refused. The `GIT_PROTOCOL` environment variable is propagated so protocol version negotiation is not silently downgraded.

Server mode over SSH is the same as over HTTP: the exec channel for `git-receive-pack` is piped into a spawned `git receive-pack` on the mirror. One gap is known. The public server API of `ssh2` accepts the client's agent-forwarding request but has no call to open the agent channel back to the client for the upstream leg. The 2.x code used private internals for this. The v3 module isolates the call behind one interface so the fix is either a small public addition to `ssh2` or the on-behalf-of forwarding strategy.
