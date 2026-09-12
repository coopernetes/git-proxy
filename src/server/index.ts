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
 * Process bootstrap. Fixed start order so nothing accepts traffic before the
 * store is migrated and the decision host is assembled; stop runs the
 * reverse order. Only policy sections reload at runtime.
 */

import { V3Config } from '../config/v3';
import { AppDependencies } from './deps';

export interface RunningServer {
  readonly config: V3Config;
  readonly deps: AppDependencies;
  /** Reverse of start: SSH, HTTP(S), sweeps, engines, stores. */
  stop(): Promise<void>;
  /**
   * Re-reads `checks`, `approval` and `authorization` seeds. Providers,
   * listeners, store and dashboard auth require a restart and are refused.
   */
  reloadPolicy(): Promise<void>;
}

/**
 * 1. load and validate config
 * 2. create stores, run migrations
 * 3. build the authorization evaluator
 * 4. build the decision host: built-in checks, then plugins
 * 5. build push and fetch engines and the approval gateway
 * 6. create the app, listen on HTTP and HTTPS as configured
 * 7. start the SSH listener when enabled
 * 8. start the review-window and unconsumed-approval sweeps
 */
export declare function start(config: V3Config): Promise<RunningServer>;
