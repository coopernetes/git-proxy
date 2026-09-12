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
 * Self-approval rule. The deciding actor must not be the submission's
 * pusher, compared by resolved user id and never by commit email. The only
 * exception is an actor holding the self-certify capability on that
 * repository who marks the approval as an override; the override is
 * recorded on the attestation. An admin role alone never satisfies the rule.
 */

import { AuthorizationEvaluator, PushRecord, User } from '../../domain';

export type ReviewerEntitlement =
  | { entitled: true; selfApprovalOverride: false }
  | { entitled: true; selfApprovalOverride: true }
  | { entitled: false; reason: 'self-approval' | 'no-review-grant' | 'pusher-unresolved' };

/**
 * A pusher whose user id could not be resolved cannot be compared, so the
 * decision fails closed for a self-review claim and for any reviewer whose
 * identity would otherwise match.
 */
export declare function checkReviewerEntitlement(
  record: PushRecord,
  reviewer: User,
  claimsOverride: boolean,
  authorization: AuthorizationEvaluator,
): Promise<ReviewerEntitlement>;
