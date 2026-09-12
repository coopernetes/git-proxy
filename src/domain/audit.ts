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
 * Audit view. The ordered sequence of transitions for a submission is
 * stored as an explicit event log so the full path can be reconstructed
 * without deriving it from the record.
 */

import { ActorType, PushState } from './push';

export interface AuditEvent {
  id: string;
  pushId: string;
  from: PushState | null;
  to: PushState;
  occurredAt: string;
  actorType: ActorType;
  actor?: { userId: string; username: string };
  /** Trigger or reason; states the mechanism for automated transitions. */
  trigger: string;
  matchedRule?: string;
}

/** A fetch has no lifecycle: one operation, one inline decision. */
export interface FetchRecord {
  id: string;
  occurredAt: string;
  repository: { providerId: string; owner: string; name: string };
  presented?: string;
  resolved?: { providerId: string; login: string };
  disposition: 'allowed' | 'denied';
  matchedRule?: string;
}

/** Administrative actions on users, groups, grants and repositories are audited with the same shape. */
export interface AdminAuditEvent {
  id: string;
  occurredAt: string;
  actor: { userId: string; username: string };
  action: string;
  target: string;
  outcome: 'success' | 'denied';
  detail?: string;
}
