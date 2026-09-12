---
title: Identity
---

# Identity

Module: `src/domain/identity.ts`, `src/identity/*`, `src/proxy/transports/ssh.ts`.

## Two kinds of identity

**The pusher** is the principal authenticated on the connection to the proxy. It is anchored to the credential the client proved possession of: a token, an SSH key or an OIDC assertion. It is the only identity that carries authorization weight.

**Commit metadata** is the author and committer written into each commit object. It is self-asserted content. It is recorded, optionally checked by policy, and never used for an authorization or approval decision.

## Resolution

`PusherResolver` turns a credential anchor into a `Pusher`.

Token: the token is presented to the provider's identity API. The provider answers with a login. The login is matched against registered SCM identities for that provider. A match yields the proxy user.

SSH key: the connecting key's fingerprint is matched against registered keys whose provenance is a provider key listing or an account link. A match yields the proxy user. A key alone cannot be reversed to an owner, so a first-time SSH pusher with no registered key is unresolvable.

The HTTP Basic username and the SSH login name are recorded as the presented identifier and are not used for resolution.

Where the provider offers no identity API, or it cannot be reached, the pusher is credential-anchored but unresolved. Controls that need a named identity fail closed for such a pusher.

A resolved login that contradicts a registered identity for the same credential is rejected.

## Assurance levels

| Level         | Meaning                                                                            |
| ------------- | ---------------------------------------------------------------------------------- |
| `unconfirmed` | No account could be resolved for the credential                                    |
| `confirmed`   | The provider resolved the credential to a login that matches a registered identity |
| `verified`    | The user-to-account link was attested by an account-linking flow                   |

Policy can require a minimum level per repository. The levels are degrees of positive confirmation. Absence of confirmation is `unconfirmed`; a contradiction is a rejection.

## The user

A user holds many emails, many SCM identities and many SSH keys. Each carries a `VerificationSource`: `provider-token`, `provider-key-listing`, `account-link`, `idp`, `admin` or `self-declared`. A self-declared key or email is stored but grants nothing until a provider, a link or an administrator attests it.

## SSH authentication

Public-key authentication has two phases. The client first asks whether a key is acceptable, then sends a request signed with that key over the session identifier. The transport verifies the signature with the presented key before the fingerprint is looked up. A key that is merely present in the user table authenticates nothing.

The SSH login name is ignored. TCP and X11 forwarding are refused. Upstream authentication uses the client's forwarded agent. Upstream host keys are pinned.

## Attribution policy

`src/identity/attribution.ts` compares commit author and committer emails with the resolved user's registered emails. Modes are `off`, `warn` and `enforce`; the default is `warn`. A mismatch produces an advisory finding on the record. Distributed authorship, rebases and automation-produced commits are ordinary and are not failures unless a rule says so.

## Providers

`src/identity/providers/*` declares, per provider kind, which identity endpoints exist and which credential header the client sends. The proxy reads the credential to resolve identity and forwards it unchanged. Bitbucket offers token identity but no key listing, and its git endpoint requires the account username; that rewrite is a documented provider constraint, not a general behaviour.
