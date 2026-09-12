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
 * Commit attribution policy. Author and committer email are self-asserted
 * commit metadata. This policy compares them to the resolved pusher's
 * registered emails and reports a finding; it is metadata hygiene and never
 * an access decision. A mismatch under `warn` is advisory. Under `enforce`
 * it is a violation the reviewer sees. `off` records nothing.
 */

import { CommitSummary, User } from '../domain';
import { Finding } from '../policy/contract';

export type AttributionMode = 'off' | 'warn' | 'enforce';

export interface AttributionPolicy {
  /** Default: warn. */
  mode: AttributionMode;
  fields: Array<'author' | 'committer'>;
  /** Emails treated as acceptable for every user, e.g. automation identities. */
  allowlist: string[];
}

export const DEFAULT_ATTRIBUTION_POLICY: AttributionPolicy = {
  mode: 'warn',
  fields: ['author', 'committer'],
  allowlist: [],
};

export interface AttributionResult {
  /** One per commit whose configured fields did not match; empty when all matched or the pusher is unresolved. */
  findings: Finding[];
  /** True only under `enforce` with at least one finding. */
  violation: boolean;
}

/** Pure. An unresolved pusher yields no findings: there is nothing to compare against. */
export declare function checkAttribution(
  policy: AttributionPolicy,
  commits: CommitSummary[],
  pusher: User | undefined,
): AttributionResult;
