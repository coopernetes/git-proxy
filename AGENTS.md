# AGENTS.md — GitProxy v3 skeleton

## What this branch is

A skeleton of a proposed GitProxy 3.0: module boundaries, types, interfaces and contracts, with no implementations. Nothing runs. The server type check (`npm run check-types:server`) and the dashboard build (`npm run build-ui`) pass; that is the bar for changes here.

Read `website/docs/v3/index.md` first. It is the canonical description of the architecture; this file is the working guide for agents.

## Commands

```
npm run check-types:server   # the server-side type check; must stay clean
npm run build-ui             # the dashboard must keep compiling
npm run test                 # everything below plus the config and dashboard service tests
npm run test:unit            # pure modules, no subprocess
npm run test:integration     # src/git against a real git in temp repositories, plus captured push fixtures
npm run fixtures:capture     # regenerate the captured git push bodies under test/git/fixtures
npm run lint / lint:fix      # eslint; lint:fix adds the license header to new files
npm run format / format:check
```

Stack: TypeScript, Node 22+, Express 5, ssh2, NeDB and MongoDB, Passport (local, Active Directory, OIDC), React dashboard, Vitest.

## Module map and dependency direction

```
index.ts               entrypoint
src/server/            one Express app (git transport, API, dashboard), SSH listener, bootstrap, authz matrix
src/proxy/             transport-neutral push and fetch engines, deferral modes, sideband, HTTP and SSH transports
src/git/               limits, pkt-line, pack admission, quarantine, mirror, receive-pack, forwarder, capabilities
src/policy/            decision contract, decision host, built-in checks, approval gateway, external protocol
src/identity/          pusher resolution, provider identity APIs, account linking, attribution policy
src/domain/            pure model: identity, repository, authorization, push record, lifecycle, audit
src/store/             store interfaces, file and Mongo skeletons, migrations
src/config/            2.x config loader plus src/config/v3.ts and config.v3.schema.json
src/service/passport/  dashboard authentication strategies, bound to the store interfaces
src/plugin.ts          plugin contract
src/ui/                the 2.x dashboard; src/ui/legacy holds the 2.x API types it still compiles against
```

Dependencies point inward: `domain` imports nothing; `policy/contract` imports `domain`; `git`, `identity`, `store` import those; `proxy` imports all of them; `server` imports everything. Express appears only in `src/server` and `src/proxy/transports/http.ts`. `ssh2` appears only in `src/proxy/transports/ssh.ts` and `src/server/ssh.ts`.

## Invariants

These are the properties the skeleton exists to demonstrate. A change that weakens one is wrong even if it type-checks.

- The pusher is resolved from the credential on the connection. Commit author and committer are never an identity.
- The push record id is assigned. No path, cache key or lookup key derives from client-supplied values.
- An approval is bound to repository, ref, old id, new id and pack digest, consumed once, and expires.
- State changes go through `src/domain/lifecycle.ts`. No other module sets a state.
- A decision point receives a `Submission` and returns a verdict. It never receives a request, a connection or a store.
- `could-not-run` is recorded as such and defaults to fail-closed.
- Every mutating API verb appears in `AUTHORIZATION_MATRIX` with its requirement.
- The proxy never persists a credential a client typed.

## Conventions

- `src/git` is implemented and tested; keep it that way. Every other module is abstractions only: interfaces, types, const tables and `export declare function` signatures. `src/utils/errors.ts` is concrete because the dashboard imports it at runtime.
- Every file opens with a short module comment naming its role and the property it protects.
- Doc comments and docs are factual and impersonal. No advisory identifiers, no issue numbers, no comparisons with other projects, no people.
- Configuration for a check lives with the check.
- New shared vocabulary goes in `src/domain` or `src/policy/contract.ts`, not in a consumer module.
- The license header is added by `npm run lint:fix`; do not hand-write it.

## Out of scope on this branch

Additional database engines, additional dashboard authentication strategies, deployment packaging beyond the Dockerfile, platform API proxying for CLI tools, stored credentials and deferred forwarding, metrics, a migration from 2.x records, and re-pointing the dashboard at the v3 API. See `website/docs/v3/scope.md`.
