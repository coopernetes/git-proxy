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
 * Inspection completeness. Every object in the received pack must be
 * reachable from the new tip and not already reachable from the old tip;
 * anything else would enter the repository without passing through
 * reachability-based inspection. When the reachable set cannot be computed
 * the verdict is could-not-run, never pass. Terminal: a violation ends
 * evaluation.
 */

import { Check } from '../contract';

export interface ReachabilityConfig {
  /** Upper bound on commits walked before the verdict is could-not-run. */
  maxCommitsWalked: number;
}

export declare const reachability: Check;
