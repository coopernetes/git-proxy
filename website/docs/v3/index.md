---
title: Overview
---

# v3 architecture (draft)

This section describes a proposed 3.0 shape for GitProxy. The branch it lives on is a skeleton: module boundaries, types, interfaces and contracts. One layer is implemented and tested, the git engine under `src/git`; the rest is declarations. It exists to show what a version built for regulated deployments looks like when the data model, the identity model and the git engine are designed together rather than extended one field at a time.

The stack is unchanged: TypeScript on Node, Express for HTTP, `ssh2` for SSH, NeDB and MongoDB for storage, Passport for dashboard authentication, React for the dashboard, Vitest for tests, a JSON-schema-driven configuration with generated types.

## Goals

1. The pusher is whoever holds the credential. Commit metadata is never an identity.
2. Every push is a record with an assigned identifier. Nothing derived from pushed content names a record, a file or an approval.
3. An approval is bound to a repository, a ref, a commit range and, where the proxy holds the pack, the pack itself. It is consumed once.
4. Untrusted input is parsed under limits that are enforced before allocation.
5. Policy checks are pure: they read a submission view and return a verdict. They never see a transport.
6. One process. One HTTP listener serves git, the API and the dashboard; the SSH listener runs alongside.
7. Fail closed. A check that could not run is recorded as such and never counts as a pass.

## Module map

```
index.ts                 entrypoint: config, validate, start
src/server/              one Express app (git transport, API, dashboard), SSH listener, bootstrap
src/proxy/               transport-neutral push and fetch engines, deferral modes, sideband
src/git/                 bounded parsing, quarantine, mirror cache, receive-pack, forwarder, capability mediation
src/policy/              decision contract, decision host, built-in checks, approval gateway, external protocol
src/identity/            credential-anchored pusher resolution, provider identity APIs, attribution policy
src/domain/              pure model: identity, repository, authorization, push record, lifecycle, audit
src/store/               store interfaces, file and Mongo skeletons, migrations
src/config/              configuration loading (kept from 2.x) plus the v3 configuration surface
src/service/passport/    local, Active Directory and OIDC strategies (kept from 2.x)
src/plugin.ts            plugin contract: checks and decision hooks against the policy contract
src/ui/                  the 2.x dashboard, to be re-pointed at the v3 API
```

Dependencies point inward. `domain` imports nothing. `policy/contract` imports `domain`. `git`, `identity` and `store` import `domain` and the contract. `proxy` imports all of those. `server` imports everything and is the only module that knows about Express beyond the HTTP transport itself.

## Request path

1. The HTTP transport or the SSH transport builds a `PushContext`: provider, canonical repository identity, credential anchor, presented identifier, negotiated capabilities, a bounded body source and a message sink.
2. The push engine refuses unregistered repositories before parsing anything.
3. The command section is parsed under limits. A push that updates more than one ref is refused.
4. The pusher is resolved from the credential. The presented name is recorded and ignored.
5. Authorization asks whether the resolved user holds the push capability on that repository. No grant means no push.
6. A push record is created in `received`, then `processing`. Its id is the correlation identifier the client sees.
7. Objects land in a quarantine that uses the mirror as an alternate. Reachability of every pack object from the ref update is verified. Commits and tag objects are summarised.
8. The decision host runs every built-in check, then plugin checks, then decision hooks, and derives one disposition.
9. The lifecycle module applies the transition and emits the audit event.
10. The deferral mode takes over: the relay mode reports the refs as rejected with the correlation id and closes; the server mode holds the connection and forwards on approval.

## Reading order

- [What 2.x carried forward from 1.x](./from-2x.md)
- [Push lifecycle](./push-lifecycle.md)
- [Identity](./identity.md)
- [Authorization](./authorization.md)
- [Policy decision contract](./policy-contract.md)
- [Git engine and transports](./git-engine.md)
- [Data model and stores](./data-model.md)
- [Service API](./service-api.md)
- [Hardening requirements](./hardening.md)
- [Scope](./scope.md)
- [Integration plan](./integration-plan.md)
