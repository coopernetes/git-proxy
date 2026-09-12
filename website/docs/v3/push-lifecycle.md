---
title: Push lifecycle
---

# Push lifecycle

Module: `src/domain/push.ts`, `src/domain/lifecycle.ts`, `src/proxy/modes/*`.

## The record

One push record per submission. It is created when the push is accepted for evaluation and carried to a terminal state. The id is assigned by the proxy, opaque and unique. It is the correlation identifier printed to the client, shown in the dashboard and used in the audit trail. Nothing derived from pushed content names a record.

A record carries exactly one ref update. A push that updates more than one ref is refused before a record exists.

## States

| State        | Meaning                                                                            | Terminal |
| ------------ | ---------------------------------------------------------------------------------- | -------- |
| `received`   | Accepted for evaluation                                                            | no       |
| `processing` | Checks running                                                                     | no       |
| `pending`    | Passed hard checks, awaiting a decision                                            | no       |
| `approved`   | Permitted, not yet forwarded                                                       | no       |
| `forwarded`  | Upstream accepted the push                                                         | yes      |
| `rejected`   | Denied by policy or by a reviewer                                                  | yes      |
| `canceled`   | Resolved without a content decision: withdrawn, client gone, review window expired | yes      |
| `error`      | Could not be processed safely, or forwarding failed                                | yes      |

## Transitions

| From         | To           | Trigger                                                      | Evidence recorded                                            |
| ------------ | ------------ | ------------------------------------------------------------ | ------------------------------------------------------------ |
| start        | `received`   | submission accepted                                          | repository, ref update, pusher, timestamp                    |
| `received`   | `processing` | evaluation begins                                            |                                                              |
| `processing` | `rejected`   | hard violation                                               | automated attestation with the rules and reason              |
| `processing` | `pending`    | hard checks passed                                           | per-check results                                            |
| `processing` | `error`      | evaluation could not complete, record could not be persisted | cause                                                        |
| `pending`    | `approved`   | reviewer decision or auto-approval                           | attestation with actor, actor type, answers, override marker |
| `pending`    | `rejected`   | reviewer decision                                            | attestation with reason                                      |
| `pending`    | `canceled`   | withdrawal, disconnect, expiry                               | attestation with reason; automated for disconnect and expiry |
| `approved`   | `forwarded`  | upstream accepted                                            | forwarded time, upstream identity used                       |
| `approved`   | `error`      | forwarding failed                                            | upstream failure cause                                       |

The transition function is pure. It takes a record and a transition, refuses any edge not in the table, refuses a transition missing its evidence, and returns the updated record with the audit event. Stores persist what it returns. No route handler and no processor sets a state field directly.

## Rules

- A hard rejection and a deferral are distinct on the wire and on the record.
- Every rejection and cancellation carries an attestation with the actor type and a reason. Automated cancellations name the mechanism.
- Every approval carries an attestation with the actor, the actor type and the timestamp.
- A submission does not stay pending indefinitely. The review window is configured; expiry cancels with an automated attestation.
- The deciding actor is never the pusher, compared by resolved user id, unless the actor holds the self-certify capability on that repository and the attestation is marked as an override. The admin role does not satisfy this.
- If the record cannot be created or cannot be read at decision time, the push is denied.
- `error` is terminal. Recovery is a new submission.
- Every transition is an audit event with a timestamp and a trigger.

## Deferral models

Both modes produce the same record, the same evidence and the same audit trail. They differ only in the client interaction.

### Relay (reject and retry)

The proxy buffers the push for inspection, evaluates it, records it and reports the refs as rejected with a reason that carries the correlation id and a review URL. The connection closes and the pack is not retained. After approval the client pushes again.

The retry is matched against the approval by the full binding: repository identity, ref, old id, new id. A retry to any other repository or ref does not consume the approval. An amended or rebased retry has a different range and is a new submission. An approval is consumed once. Unconsumed approvals expire.

The live record for the retry is its own record. It references the consumed approval; it is never replaced by the stored record.

### Server (held connection)

The proxy is the receive-pack endpoint. Objects are received into quarantine, the pack digest is recorded on the record, evaluation runs, and the connection is held with heartbeat progress until a decision arrives or the review window expires. On approval the proxy forwards the retained objects upstream itself; the client re-uploads nothing. On rejection or expiry the refs are reported as rejected with the reason. If the client disconnects while pending, the record is canceled and nothing is forwarded.

A held connection pins the wait to one instance. Resolution is observed through the store.

Forwarding uses the client's own credential for that request, held in memory only, or the client's forwarded SSH agent. The skeleton defines no stored-credential strategy. Forwarding later, after the client has gone, needs a delegated-credential design and is out of scope.
