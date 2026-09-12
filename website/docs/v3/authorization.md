---
title: Authorization
---

# Authorization

Module: `src/domain/authorization.ts`, `src/server/authz.ts`, `src/policy/approval/selfApproval.ts`.

## Grants as capability sets

Capabilities are atomic: `push`, `review`, `self-certify`, `cancel`, `fetch`. A grant is a named set of capabilities. Relationships between grants are set operations: a grant implies another when it contains every capability of the other. Adding a grant is one line in the table; there is no pairwise logic to keep consistent.

An empty capability set is a configuration error and matches nothing.

## Targets

A grant applies to a target: the repository slug, the owner, or the name, matched literally, by glob or by regex. Matching is case-insensitive for every kind because every provider resolves `owner/name` case-insensitively. A grant may be restricted to one provider.

## Subjects

A grant is held by a user or by a group. Groups are membership lists and may mirror an IdP group so that external group membership drives access and falls inside the organisation's existing access review.

## Evaluation

`AuthorizationEvaluator.evaluate(query)` answers one question: does this user hold this capability on this repository. It collects the user's direct grants and the grants of every group the user belongs to, matches targets, and returns the matched grant id for the audit record. No match is a denial. There is no default grant.

Config-sourced grants and groups are seeded at startup and are immutable through the API.

## Access rules

Fetches and unauthenticated reads have no lifecycle. `AccessRule` is an ordered allow/deny list on targets per service. First match wins. A fetch-only deployment is an access-rule set with `receive-pack` denied everywhere.

## Roles

Roles are data on the user: `user`, `reviewer`, `admin`. `admin` grants administration of users, groups, grants, repositories and access rules. It does not grant review or self-certification on any repository. IdP-provisioned users have their roles persisted at login.

## Self-approval

The deciding actor of an approval is compared with the pusher by resolved user id. If they are the same user, the approval is refused unless the actor holds `self-certify` on that repository and marks the attestation as an override. The override is recorded on the attestation and in the audit event. An unresolved pusher cannot be self-approved because there is no id to compare.

## API authorization

Every mutating verb is denied unless a matrix entry permits it. `AUTHORIZATION_MATRIX` in `src/server/authz.ts` lists route pattern, verb and requirement in one place so it can be reviewed and covered by a single matrix test. Requirements are `authenticated`, `role:<r>` or `capability:<c>` resolved against the repository named in the request. Listing users requires the admin role. Email addresses are not returned to non-admins.
