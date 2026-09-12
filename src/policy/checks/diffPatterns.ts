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
 * Diff content rules. Literal and regular-expression blocks evaluated over
 * the diff the push introduces, with named pattern sets that can be scoped
 * to a provider.
 */

import { Check } from '../contract';

export interface DiffPatternsConfig {
  blockLiterals: string[];
  blockPatterns: string[];
  /** Additional pattern sets applied only to pushes for the named provider. */
  providers: Record<string, { blockLiterals: string[]; blockPatterns: string[] }>;
}

export declare const diffPatterns: Check;
