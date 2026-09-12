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
 * Server mode: held connection. `git receive-pack` receives the pack into
 * quarantine, the pack digest is recorded, the decision host runs from the
 * pre-receive hook, and the connection is held with heartbeats until a
 * decision arrives or the review window closes. A client disconnect cancels
 * the submission and nothing is forwarded on its behalf; approval forwards
 * the quarantined objects and the record ends in `forwarded` or `error`.
 * The wait pins the submission to one proxy instance.
 */

import { Forwarder, ReceivePackRunner } from '../../git';
import { ReviewWindowPolicy } from '../../domain';
import { PushContext } from '../context';
import { PushEngine } from '../engine';

export interface ServerMode {
  readonly engine: PushEngine;
  readonly receivePack: ReceivePackRunner;
  readonly forwarder: Forwarder;
  readonly reviewWindow: ReviewWindowPolicy;
  handle(context: PushContext): Promise<void>;
}

/** Observes the record until it leaves `pending`, or the window closes, or the client goes. */
export interface ResolutionWatcher {
  wait(
    pushId: string,
    abort: AbortSignal,
    maxPendingSeconds: number,
  ): Promise<'approved' | 'rejected' | 'canceled' | 'timeout' | 'disconnect'>;
}
