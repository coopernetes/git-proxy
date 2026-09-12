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
 * Commit trailer policy. Enforces sign-off presence and provenance and
 * governs co-author trailers, which are self-asserted attribution and are
 * treated as content rules rather than identity.
 */

import { Check } from '../contract';

export type CoAuthorPolicy = 'off' | 'ban' | 'allowlist' | 'require';

export interface TrailersConfig {
  signedOffBy: {
    require: boolean;
    /** The sign-off email must match the commit author's email. */
    requireAuthorMatch: boolean;
  };
  coAuthoredBy: {
    policy: CoAuthorPolicy;
    /** Addresses or domains permitted under `allowlist`. */
    allow: string[];
  };
}

export declare const trailers: Check;
