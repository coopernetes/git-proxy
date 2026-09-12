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
 * Secret scanning through gitleaks. Runs against the quarantined objects
 * with the mirror as an alternate object directory so thin packs resolve.
 * The binary is probed before scanning; absence or a failed preflight is
 * could-not-run, never a silent pass.
 */

import { Check } from '../contract';

export interface SecretsConfig {
  enabled: boolean;
  /** Path to the gitleaks binary; probed for presence and version at startup and per run. */
  binaryPath: string;
  configPath?: string;
  /** Ignore in-repo allow rules (`gitleaks:allow` comments and .gitleaksignore). */
  ignoreAllowRules: boolean;
  timeoutSeconds: number;
}

export declare const secrets: Check;
