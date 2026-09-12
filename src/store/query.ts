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
 * Query and paging shapes shared by every store implementation. Paging is
 * cursor-based so list endpoints stay stable while records are appended.
 */

import { PushState } from '../domain';

export interface PushQuery {
  state?: PushState[];
  repository?: { providerId?: string; owner?: string; name?: string };
  /** Proxy user the pusher resolved to. */
  pusherUserId?: string;
  ref?: string;
  receivedAfter?: string;
  receivedBefore?: string;
}

export interface PageRequest {
  /** Opaque, from a previous page. */
  cursor?: string;
  /** Bounded by the store's maximum. */
  limit?: number;
}

export interface Page<T> {
  items: T[];
  nextCursor?: string;
}
