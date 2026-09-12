---
title: Policy decision contract
---

# Policy decision contract

Module: `src/policy/contract.ts`, `src/policy/disposition.ts`, `src/policy/checks/*`, `src/policy/external.ts`, `src/plugin.ts`.

## The submission view

A decision point receives a read-only `Submission`: the record id, the canonical repository identity, the ref update, the pusher (anchor, presented identifier, resolved identity, assurance level), the commit summaries, the tag summary where present, and `SubmissionContent` for streaming access to the diff, the introduced objects and blobs, and changed paths. Content is resolved against the quarantine with the mirror as an alternate, so thin packs are complete.

A decision point receives nothing else. No request object, no connection, no store. The same decision point runs unchanged under the relay mode, the server mode and the SSH transport.

Parsing, identity resolution and commit enrichment are complete before the first decision point runs. Plugin decision points run after the built-in ones.

## Verdicts

| Verdict         | Who may return it | Meaning                              |
| --------------- | ----------------- | ------------------------------------ |
| `pass`          | check, hook       | The rule is satisfied                |
| `violation`     | check, hook       | The rule is broken; carries findings |
| `could-not-run` | check, hook       | No conclusion could be reached       |
| `defer`         | hook              | Human review required                |
| `allow`         | hook              | May proceed without review           |

A check reports on content. A decision hook may also route. A verdict outside the decision point's role is treated as `could-not-run`.

A finding carries a rule id, a severity, a message and a locator. It locates; it does not quote secret material.

## Disposition

The decision host runs every applicable check and collects every verdict so the client sees the full set of findings at once. A check marked terminal by host configuration ends evaluation early; nothing in the submission can influence which checks are terminal.

Derivation order:

1. Any `could-not-run` applies its disposition: `reject`, `defer` or `pass-through`. The default is fail-closed. `pass-through` is an explicit, named, per-decision-point opt-in and is recorded as such on the record, never as a pass.
2. Any `violation` not routed to review by configuration, with no overriding `allow`, gives `rejected`.
3. An `allow` from a decision hook makes the submission eligible to bypass review, subject to the self-approval rule and to an automated attestation.
4. Otherwise, `pending`.

Every executed decision point produces a `StepResult` on the record with its outcome, message, findings and timing. `could-not-run` is a distinct outcome, never folded into pass or fail.

## Built-in checks

In execution order: reachability (terminal), tag objects, object size, LFS pointers, binary content, commit messages, trailers, author attribution (advisory), signatures (advisory), diff patterns, secrets. Each check owns its configuration type.

The secrets check runs gitleaks against the quarantined objects with the mirror as the alternate object directory. It checks for the binary and for the tip object up front; absence is `could-not-run`, never a pass.

## Approval gateway

`ApprovalGateway.decide(record)` returns `auto-approve`, `auto-reject` or `await-review`. Three gateways are declared: rule-driven auto decisions from configuration, the dashboard review, and an external delegate. The gateway is selected globally or per repository. An automated approval carries an automated attestation and is still subject to the self-approval rule.

## External decision protocol

An external delegate is reached over HTTP with a JSON body carrying the protocol version and the submission projection. The client's credential is never included. The response carries one verdict from the vocabulary allowed to the delegate's role. An unparseable response, a timeout or an unreachable delegate is `could-not-run` and takes the fail-closed disposition. A delegate cannot fail open by being switched off.

An adapter maps a policy engine's `{ decision, reasons, obligations }` document onto the vocabulary, so an existing policy engine can be the decision hook without a bespoke protocol.

## Plugins

A plugin module exports a manifest (name, version, contract version) and optional `checks` and `decisionHooks`. The loader validates the manifest and registers them with origin `plugin`, which places them after the built-ins. A plugin sees the submission view and returns a verdict. It cannot mutate the record, reach the store, or observe the transport.
