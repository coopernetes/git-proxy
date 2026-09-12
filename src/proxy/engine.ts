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
 * The push engine: the single path every transport and mode goes through.
 * Stages, in order:
 *  1. registered-repository lookup; an unknown repository is refused before parsing
 *  2. command parsing under limits; more than one ref update is refused
 *  3. identity resolution anchored to the credential; the presented name is recorded only
 *  4. authorization for the push capability, fail closed
 *  5. record created in `received`, then `processing`
 *  6. quarantine and enrichment: every pack object reachable from the ref update,
 *     annotated tag objects inspected as objects
 *  7. decision host
 *  8. disposition applied as a lifecycle transition
 *  9. hand-off to the mode (relay or server)
 */

import { AccessRule, PushRecord, Pusher, RefUpdate, RepositoryIdentity } from '../domain';
import { Disposition } from '../policy/disposition';
import { Submission } from '../policy/contract';
import { AdvertisementContext, FetchContext, PushContext } from './context';

export interface ParsedPush {
  repository: RepositoryIdentity;
  update: RefUpdate;
  capabilities: string[];
  pusher: Pusher;
}

export interface EnrichedPush extends ParsedPush {
  record: PushRecord;
  submission: Submission;
}

export interface PushOutcome {
  record: PushRecord;
  disposition: Disposition;
}

export interface PushEngine {
  /** Stages 1 to 8. Returns the record in `pending`, `rejected`, `error` or eligible for allow. */
  evaluate(context: PushContext): Promise<PushOutcome>;
  /** Stages 1 to 4 only; used by the relay mode to match a retry before re-evaluating. */
  parse(context: PushContext): Promise<ParsedPush>;
}

export interface FetchEngine {
  /** Access rules first, fail closed; then capability mediation; then relay of the upstream stream. */
  serve(context: FetchContext | AdvertisementContext): Promise<void>;
}

export interface AccessRuleEvaluator {
  evaluate(input: {
    repository: RepositoryIdentity;
    service: 'upload-pack' | 'receive-pack';
    pusher?: Pusher;
  }): Promise<{ effect: 'allow' | 'deny'; matched?: AccessRule }>;
}
