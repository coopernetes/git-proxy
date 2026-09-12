---
title: Data model and stores
---

# Data model and stores

Module: `src/domain/*`, `src/store/*`.

## Entities

| Entity                 | Key                                  | Notes                                                                                   |
| ---------------------- | ------------------------------------ | --------------------------------------------------------------------------------------- |
| `Provider`             | id                                   | From configuration; read-only                                                           |
| `User`                 | id, unique username                  | Roles, emails, SCM identities, SSH keys, each with a verification source                |
| `Group`                | id                                   | Membership list; optional IdP group mirror                                              |
| `Grant`                | id                                   | Grant name, target, subject (user or group), optional provider, who granted it and when |
| `AccessRule`           | id, order                            | Allow/deny on targets per service                                                       |
| `RegisteredRepository` | id, unique (providerId, owner, name) | Upstream URL retained for forwarding                                                    |
| `PushRecord`           | assigned id                          | One per submission; commits, tag, steps, attestations, pack digest                      |
| `AuditEvent`           | id                                   | One per transition; indexed by push id                                                  |
| `FetchRecord`          | id                                   | One per policy-evaluated fetch                                                          |
| `AdminAuditEvent`      | id                                   | Administrative mutations                                                                |
| Session                | session id                           | Dashboard sessions; TTL                                                                 |

Grants are stored separately from repositories and users. The repository document holds no access lists.

## Store interfaces

One narrow interface per aggregate, each exposing only the queries the engine and the API need. `PushStore` includes `findApproval(binding)` and `consumeApproval(id)`, so approval consumption is a store operation with a single-use guarantee rather than a comparison in a route handler. Lookups by email return arrays; an email is not a unique key.

`Stores` bundles them. `StoreFactory` produces a bundle for `file` or `mongo`.

## Indexes

Both stores declare their indexes in a const table that is applied at startup. Unique: push id, username, (providerId, login), key fingerprint, (providerId, owner, name). Non-unique: push state with received time, repository slug, email address, audit event push id. Sessions carry a TTL index in Mongo.

The file store cannot join. Grant evaluation runs two lookups: direct grants, then grants for the user's group ids.

## Migrations

`src/store/migrations/registry.ts` is a versioned registry with an applied-migrations record. Each migration declares an `up` per store kind. The first entry describes the v3 target shape. There is no in-place upgrade from 2.x records on this branch; the shape change is the point.

## Configuration surface

`src/config/v3.ts` and `config.v3.schema.json` define the v3 configuration: providers, listeners, modes, limits, identity, authorization seeds, approval, checks, plugins, store and dashboard authentication. The pattern from 2.x is kept: a JSON schema from which types and reference documentation are generated. Policy sections are hot-reloadable. Providers, listeners and stores are not.
