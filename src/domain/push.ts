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
 * The push record: one per submission, created when a push is accepted for
 * evaluation and carried to a terminal state. Its identifier is assigned by
 * the proxy and is opaque; nothing about it is derived from pushed content,
 * so two pushes of the same commits are two records and no client-supplied
 * value ever names a file or a directory.
 */

import { Pusher } from './identity';
import { RepositoryIdentity } from './repository';
import { StepResult } from '../policy/contract';

/** Hash algorithm of the repository. Both are handled; object ids are validated to the format's length. */
export type ObjectFormat = 'sha1' | 'sha256';

/** Per-ref outcome as git reports it: `ok <ref>` or `ng <ref> <reason>`. */
export type RefResult = { ref: string; ok: true } | { ref: string; ok: false; reason: string };

/** The eight canonical lifecycle states. Exactly one applies at any time. */
export type PushState =
  | 'received'
  | 'processing'
  | 'pending'
  | 'approved'
  | 'forwarded'
  | 'rejected'
  | 'canceled'
  | 'error';

export const TERMINAL_STATES: ReadonlySet<PushState> = new Set<PushState>([
  'forwarded',
  'rejected',
  'canceled',
  'error',
]);

/** Every legal transition. Anything not listed here is refused by the lifecycle. */
export const TRANSITIONS: ReadonlyArray<readonly [from: PushState, to: PushState]> = [
  ['received', 'processing'],
  ['processing', 'pending'],
  ['processing', 'rejected'],
  ['processing', 'error'],
  ['pending', 'approved'],
  ['pending', 'rejected'],
  ['pending', 'canceled'],
  ['approved', 'forwarded'],
  ['approved', 'error'],
];

export type ActorType = 'automated' | 'human';

/** Who decided, and on what basis. Attached to every transition that needs evidence. */
export interface Attestation {
  actorType: ActorType;
  /** Present when the actor is human. */
  actor?: { userId: string; username: string };
  timestamp: string;
  /** Required on rejection and cancellation; states the mechanism for automated ones (expiry, disconnect). */
  reason?: string;
  /** Answers to the configured attestation questions, on approval. */
  answers?: Array<{ question: string; answered: boolean }>;
  /** Set whenever a self-approval override entitlement was exercised. */
  selfApprovalOverride?: boolean;
  /** Rule that drove an automated decision, when one did. */
  matchedRule?: string;
}

/** The single ref update a submission carries. Multi-ref pushes are refused before a record exists. */
export interface RefUpdate {
  /** Full ref name, validated against git's ref-name rules. */
  ref: string;
  /** Hex object id or the all-zero id for creation. Validated to the object format's length. */
  oldOid: string;
  /** Hex object id or the all-zero id for deletion. */
  newOid: string;
}

export interface CommitSummary {
  oid: string;
  parents: string[];
  author: { name: string; email: string; timestamp: number };
  committer: { name: string; email: string; timestamp: number };
  message: string;
  /** Present when the commit object carries a signature block; verification is a policy check. */
  signature?: string;
  trailers?: Record<string, string[]>;
}

export interface TagSummary {
  oid: string;
  name: string;
  targetOid: string;
  targetType: 'commit' | 'tree' | 'blob' | 'tag';
  tagger?: { name: string; email: string; timestamp: number };
  message: string;
  signature?: string;
}

export interface PushRecord {
  /** Assigned, opaque, unique. The correlation identifier shown to the client. */
  id: string;
  state: PushState;
  receivedAt: string;
  repository: RepositoryIdentity;
  refUpdate: RefUpdate;
  transport: 'https' | 'ssh';
  /** Which deferral model governed this submission. */
  mode: 'relay' | 'server';
  pusher: Pusher;
  /** Client agent string when advertised; aids audit only. */
  clientAgent?: string;
  commits: CommitSummary[];
  /** Populated for annotated tag pushes. */
  tag?: TagSummary;
  /** One entry per executed decision point, in execution order. */
  steps: StepResult[];
  /** Digest of the received pack; part of the approval binding in server mode. */
  packDigest?: string;
  /** One-line disposition for list views. */
  summary?: string;
  approval?: Attestation;
  rejection?: Attestation;
  cancellation?: Attestation;
  /** Cause on `error`, including an upstream failure after approval. */
  errorCause?: string;
  forwardedAt?: string;
  /** Relay mode: the approval this retry consumed. The retry is its own record. */
  consumedApprovalId?: string;
  /** Set on an approved record when a retry consumed it; an approval is consumed once. */
  approvalConsumedAt?: string;
  /** Upstream identity actually used to forward, when it differs from the pusher's. */
  forwardedAs?: string;
}

/**
 * The binding an approval is consumed against. A retry must match all of it;
 * an amended or rebased retry is a new submission.
 */
export interface ApprovalBinding {
  repository: RepositoryIdentity;
  refUpdate: RefUpdate;
  packDigest?: string;
}
