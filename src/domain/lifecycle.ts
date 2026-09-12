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
 * Lifecycle enforcement. The store is not trusted to keep the state machine
 * honest; every transition goes through here, which refuses illegal edges
 * and missing evidence, and emits the audit event for the edge taken.
 */

import { Attestation, PushRecord, PushState } from './push';
import { AuditEvent } from './audit';

export type Transition =
  | { to: 'processing' }
  | { to: 'pending'; summary: string }
  | { to: 'rejected'; attestation: Attestation }
  | { to: 'canceled'; attestation: Attestation }
  | { to: 'approved'; attestation: Attestation }
  | { to: 'forwarded'; forwardedAt: string; forwardedAs?: string }
  | { to: 'error'; cause: string };

export class IllegalTransitionError extends Error {
  constructor(
    readonly from: PushState,
    readonly to: PushState,
  ) {
    super(`illegal transition ${from} -> ${to}`);
  }
}

/** Pure: returns the updated record and the audit event, or throws. Persistence is the caller's job. */
export declare function transition(
  record: PushRecord,
  next: Transition,
): { record: PushRecord; event: AuditEvent };

/** Whether `from -> to` is a listed edge. */
export declare function isLegal(from: PushState, to: PushState): boolean;

/**
 * Bounded review window. A submission left `pending` past the window is
 * canceled with an automated attestation naming the timeout. Runs as a
 * sweep for the relay model and as the held-connection timeout in server mode.
 */
export interface ReviewWindowPolicy {
  /** Maximum time a submission may stay pending, in seconds. */
  maxPendingSeconds: number;
  /** Maximum time an approval may remain unconsumed in the relay model, in seconds. */
  maxUnconsumedApprovalSeconds: number;
}
