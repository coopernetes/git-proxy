---
title: Service API
---

# Service API

Module: `src/server/routes/*`, `src/server/authz.ts`. Machine-readable form: `openapi.v3.yaml` at the repository root.

One HTTP listener serves the API under `/api/v1`, the git transport under `/git`, and the dashboard. Session cookies for the dashboard, bearer JWT for scripted clients. Every route and verb appears in `AUTHORIZATION_MATRIX`; a mutating verb absent from the matrix is denied.

Requirement column: `public`, `auth` (any authenticated user), `admin` (role), `cap:<c>` (the capability on the repository named by the request), `owner|cap:cancel` (the pusher, or the capability).

## Pushes

| Verb | Path                   | Requirement         | Notes                                                                                                                                                |
| ---- | ---------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET  | `/pushes`              | auth                | Query by state, repository, ref, pusher, date; cursor paginated                                                                                      |
| GET  | `/pushes/counts`       | auth                | Per-state counts for list views                                                                                                                      |
| GET  | `/pushes/{id}`         | auth                | The push record                                                                                                                                      |
| GET  | `/pushes/{id}/audit`   | auth                | Ordered transition events                                                                                                                            |
| GET  | `/pushes/{id}/diff`    | auth                | Unified diff of the introduced range                                                                                                                 |
| POST | `/pushes/{id}/approve` | cap:review          | pending to approved. Reviewer from the session, compared with the resolved pusher by user id. Body: attestation answers, self-approval override flag |
| POST | `/pushes/{id}/reject`  | cap:review          | pending to rejected. Reason required                                                                                                                 |
| POST | `/pushes/{id}/cancel`  | owner or cap:cancel | pending to canceled. Reason required                                                                                                                 |

Transitions happen only through the lifecycle module. A request against a record in the wrong state is a 409.

## Repositories

| Verb   | Path                        | Requirement | Notes                                                |
| ------ | --------------------------- | ----------- | ---------------------------------------------------- |
| GET    | `/repositories`             | auth        |                                                      |
| GET    | `/repositories/{id}`        | auth        |                                                      |
| GET    | `/repositories/{id}/grants` | auth        | Grants whose target matches this repository          |
| POST   | `/repositories`             | admin       | Register by provider and path; nested owners allowed |
| DELETE | `/repositories/{id}`        | admin       | Push records keep their identity tuple               |

## Users

| Verb   | Path                                        | Requirement | Notes                                                   |
| ------ | ------------------------------------------- | ----------- | ------------------------------------------------------- |
| GET    | `/users/me`                                 | auth        | Emails, identities, keys with their verification source |
| GET    | `/users/me/grants`                          | auth        | Effective grants, direct and via groups                 |
| POST   | `/users/me/emails`                          | auth        | Self-declared                                           |
| DELETE | `/users/me/emails/{address}`                | auth        |                                                         |
| POST   | `/users/me/identities`                      | auth        | Self-declared provider login                            |
| DELETE | `/users/me/identities/{providerId}/{login}` | auth        |                                                         |
| POST   | `/users/me/ssh-keys`                        | auth        | Self-declared                                           |
| DELETE | `/users/me/ssh-keys/{fingerprint}`          | auth        |                                                         |
| GET    | `/users/me/links/{providerId}`              | auth        | Starts an account-linking flow                          |
| GET    | `/users/me/links/{providerId}/callback`     | auth        | Completes it; the identity becomes verified             |
| GET    | `/users`                                    | admin       | Email addresses are returned to admins only             |
| GET    | `/users/{id}`                               | admin       |                                                         |
| POST   | `/users`                                    | admin       | Config-sourced users are refused                        |
| PATCH  | `/users/{id}`                               | admin       |                                                         |
| PUT    | `/users/{id}/roles`                         | admin       | Audited                                                 |
| DELETE | `/users/{id}`                               | admin       |                                                         |
| GET    | `/users/{id}/grants`                        | admin       |                                                         |
| POST   | `/users/{id}/emails`                        | admin       | Source recorded as admin                                |
| POST   | `/users/{id}/identities`                    | admin       | Source recorded as admin                                |

A self-declared email, identity or key grants nothing until a provider lookup, a link or an administrator attests it.

## Groups and grants

| Verb   | Path                            | Requirement | Notes                                                                    |
| ------ | ------------------------------- | ----------- | ------------------------------------------------------------------------ |
| GET    | `/groups`                       | admin       |                                                                          |
| POST   | `/groups`                       | admin       |                                                                          |
| PUT    | `/groups/{id}`                  | admin       |                                                                          |
| DELETE | `/groups/{id}`                  | admin       |                                                                          |
| POST   | `/groups/{id}/members`          | admin       |                                                                          |
| DELETE | `/groups/{id}/members/{userId}` | admin       |                                                                          |
| GET    | `/groups/{id}/grants`           | admin       |                                                                          |
| GET    | `/grants`                       | admin       |                                                                          |
| POST   | `/grants`                       | admin       | Grant name, target, subject, optional provider                           |
| DELETE | `/grants/{id}`                  | admin       |                                                                          |
| POST   | `/grants/test`                  | admin       | Evaluates an authorization query; returns the decision and matched grant |

Every mutation appends an administrative audit event.

## Access rules

| Verb   | Path                  | Requirement | Notes                                                  |
| ------ | --------------------- | ----------- | ------------------------------------------------------ |
| GET    | `/access-rules`       | admin       | In evaluation order                                    |
| POST   | `/access-rules`       | admin       |                                                        |
| PUT    | `/access-rules/{id}`  | admin       |                                                        |
| DELETE | `/access-rules/{id}`  | admin       |                                                        |
| PUT    | `/access-rules/order` | admin       | Replace the order                                      |
| POST   | `/access-rules/test`  | admin       | Evaluates a path and service; returns the matched rule |

## Providers, configuration, setup, audit

| Verb | Path             | Requirement | Notes                                                           |
| ---- | ---------------- | ----------- | --------------------------------------------------------------- |
| GET  | `/providers`     | auth        | Configured providers with capability flags; presence only       |
| GET  | `/config`        | admin       | Effective configuration, secrets redacted, source per section   |
| POST | `/config/reload` | admin       | Policy sections only; audited                                   |
| GET  | `/setup`         | public      | Proxy URL shape per provider and a generated git config snippet |
| GET  | `/audit`         | admin       | Administrative events, paginated                                |
| GET  | `/audit/fetches` | admin       | Fetch operation records, paginated                              |

## Authentication

| Verb | Path             | Requirement | Notes                                            |
| ---- | ---------------- | ----------- | ------------------------------------------------ |
| POST | `/auth/login`    | public      | Local credentials, or the start of the OIDC flow |
| POST | `/auth/logout`   | auth        |                                                  |
| GET  | `/auth/me`       | auth        |                                                  |
| POST | `/auth/password` | auth        | Local strategy; honours the must-change flag     |

Health is `/healthz` and readiness `/readyz` at the root, outside the API prefix.
