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
 * LFS pointer refusal. A pointer file stands in for content that is
 * transferred outside the proxied connection and never inspected. Pointers
 * are refused by default; pass-through is an explicit opt-in recorded on the
 * push record.
 */

import { Check } from '../contract';

export interface LfsPointersConfig {
  /** Default false: pushes introducing LFS pointers are rejected. */
  allowPassThrough: boolean;
}

export declare const lfsPointers: Check;
