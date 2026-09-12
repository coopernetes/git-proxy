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
 * Binary blob detection by magic bytes. Content that text-based scanners
 * cannot read is refused unless its path or detected type is allowlisted.
 */

import { Check } from '../contract';

export interface BinaryContentConfig {
  enabled: boolean;
  /** Glob patterns of paths permitted to carry binary content. */
  allowPaths: string[];
  /** Detected media types permitted anywhere, e.g. image/png. */
  allowTypes: string[];
}

export declare const binaryContent: Check;
