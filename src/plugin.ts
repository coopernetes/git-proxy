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
 * Plugin contract. A plugin contributes checks and decision hooks written
 * against the policy contract. It receives the read-only submission view and
 * returns a verdict; it never sees a request object, a connection, or the
 * push record, and it cannot alter evaluation of any other decision point.
 * Plugins register with origin 'plugin' so they always run after built-ins.
 *
 * Migration note for existing plugins: a plugin used to receive a request
 * object and a mutable action and expressed its result by mutating that
 * action. It now receives a Submission and returns a CheckVerdict or
 * DecisionVerdict. Data previously read from the request (headers, URL) is
 * either on the submission (repository, pusher, ref update) or deliberately
 * unavailable.
 */

import { Check, DecisionHook } from './policy/contract';
import { DecisionHost } from './policy/disposition';

export const PLUGIN_CONTRACT_VERSION = '3' as const;

export interface PluginManifest {
  name: string;
  version: string;
  contractVersion: typeof PLUGIN_CONTRACT_VERSION;
}

/** Shape of a plugin module's exports. */
export interface PluginModule {
  manifest: PluginManifest;
  checks?: Check[];
  decisionHooks?: DecisionHook[];
}

export interface PluginLoader {
  /** Resolves each target as a file path or npm module name, validates the manifest, rejects unknown contract versions. */
  load(targets: string[]): Promise<PluginModule[]>;
  /** Registers every check and hook with origin 'plugin'. */
  register(host: DecisionHost, modules: PluginModule[]): void;
}

export declare function isPluginModule(candidate: unknown): candidate is PluginModule;
