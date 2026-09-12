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
 * Author and committer attribution. Commit metadata is self-asserted, so
 * this check only reports whether the author and committer emails belong to
 * the resolved pusher's registered emails. Advisory by default; blocking is
 * an explicit operator choice and never an identity decision.
 */

import { Check } from '../contract';
import { AttributionMode } from '../../identity/attribution';

export interface AuthorAttributionConfig {
  author: AttributionMode;
  committer: AttributionMode;
  /** Domains and addresses allowed or blocked regardless of registration; block wins. */
  rules: Array<{
    action: 'allow' | 'block';
    field: 'domain' | 'local' | 'address';
    match: 'literal' | 'regex';
    value: string;
  }>;
}

export declare const authorAttribution: Check;
