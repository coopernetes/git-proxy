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
 * Signature verification for commits and tags against configured keyrings.
 * An unverified signature is an advisory finding by default; requiring one is
 * an explicit operator choice. A keyring that cannot be loaded yields
 * could-not-run.
 */

import { Check } from '../contract';

export interface SignaturesConfig {
  mode: 'off' | 'advisory' | 'require';
  /** Paths to public keyrings (OpenPGP or SSH allowed-signers). */
  keyrings: string[];
  /** Apply the same mode to annotated tags. Default true. */
  includeTags: boolean;
}

export declare const signatures: Check;
