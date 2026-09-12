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
 * Built-in checks in execution order. Ordering dependencies: reachability
 * runs first because every later check reads content through the introduced
 * range; objectSize precedes content checks so nothing above the ceiling is
 * opened; lfsPointers and binaryContent precede text scanning because both
 * name content the scanners cannot read; secrets and diffPatterns run last as
 * the most expensive. Extension checks always follow this list.
 */

import { Check } from '../contract';
import { authorAttribution } from './authorAttribution';
import { binaryContent } from './binaryContent';
import { commitMessages } from './commitMessages';
import { diffPatterns } from './diffPatterns';
import { lfsPointers } from './lfsPointers';
import { objectSize } from './objectSize';
import { reachability } from './reachability';
import { secrets } from './secrets';
import { signatures } from './signatures';
import { tagObjects } from './tagObjects';
import { trailers } from './trailers';

export const BUILTIN_CHECKS: ReadonlyArray<Check> = [
  reachability,
  objectSize,
  tagObjects,
  commitMessages,
  trailers,
  authorAttribution,
  signatures,
  lfsPointers,
  binaryContent,
  secrets,
  diffPatterns,
];

/** Checks whose violation ends evaluation early. */
export const TERMINAL_CHECKS: ReadonlySet<string> = new Set(['reachability', 'objectSize']);

export * from './authorAttribution';
export * from './binaryContent';
export * from './commitMessages';
export * from './diffPatterns';
export * from './lfsPointers';
export * from './objectSize';
export * from './reachability';
export * from './secrets';
export * from './signatures';
export * from './tagObjects';
export * from './trailers';
