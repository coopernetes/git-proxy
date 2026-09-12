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
 * Push routes. Decisions come from the session identity and the record's
 * resolved pusher; the record only changes state through the lifecycle
 * module, so the API cannot produce a transition the engine would not.
 */

import { Router } from 'express';
import { AppDependencies, PushQuery } from '../deps';

export interface ApproveRequest {
  answers: Array<{ question: string; answered: boolean }>;
  /** Explicit request to exercise a self-approval override entitlement. Recorded when honoured. */
  selfApprovalOverride?: boolean;
}

export interface DecisionRequest {
  /** Required on reject and cancel. */
  reason: string;
}

/**
 * GET    /            list, PushQuery from the query string, cursor paginated
 * GET    /:id
 * GET    /:id/audit   ordered transition events
 * GET    /:id/diff    unified diff of the introduced range, redaction applied
 * GET    /counts      per-state counts for list views
 * POST   /:id/approve pending -> approved; reviewer from session; self-approval rule consulted first
 * POST   /:id/reject  pending -> rejected
 * POST   /:id/cancel  pending -> canceled; pusher, cancel capability, or admin
 *
 * After approve or reject the engine is notified so a held connection completes.
 */
export declare function createPushRoutes(deps: AppDependencies): Router;

export type { PushQuery };
