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
 * Relay mode: reject and retry. A reviewable push is recorded and its ref is
 * reported `ng` with the correlation id and review URL; the connection
 * closes and the pack is not retained. A later push of the same content
 * consumes the approval only when the full binding matches: repository
 * identity, ref, old and new object ids. The live record of the retry is
 * never replaced by the stored one; the retry is its own record referencing
 * the approval it consumed. An approval is single-use and expires.
 */

import { ApprovalBinding, PushRecord } from '../../domain';
import { PushContext } from '../context';
import { PushEngine } from '../engine';

export interface ApprovalMatch {
  /** The approved record, in `approved`, not yet consumed and not expired. */
  approved: PushRecord;
}

export interface RelayMode {
  readonly engine: PushEngine;
  /** Full request handling for one receive-pack request. */
  handle(context: PushContext): Promise<void>;
}

/** Exact binding match; an amended or rebased retry is a new submission. */
export declare function matchRetry(
  binding: ApprovalBinding,
  candidates: PushRecord[],
  now: string,
  maxUnconsumedApprovalSeconds: number,
): ApprovalMatch | undefined;
