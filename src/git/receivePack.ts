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
 * Server-mode receive. The proxy runs `git receive-pack` against the mirror
 * so git owns unpacking, quarantine and ref updates. A pre-receive hook
 * hands the submission to the decision host and may hold the process until
 * a decision arrives. The subprocess environment carries no credential.
 */

import { RefUpdate } from '../domain';
import { ParseLimits } from './limits';
import { MirrorEntry } from './mirror';

/** Variables passed to the subprocess; nothing else from the proxy's environment leaks in. */
export interface ReceivePackEnv {
  GIT_DIR: string;
  /** Requested protocol version, propagated from Git-Protocol or the SSH environment. */
  GIT_PROTOCOL?: string;
  /** Correlation id the hook uses to find its submission. */
  GIT_PROXY_PUSH_ID: string;
  /** Endpoint the hook calls back into the decision host on. */
  GIT_PROXY_HOOK_SOCKET: string;
}

import { RefResult } from '../domain';
export type { RefResult };

export interface ReceivePackResult {
  unpackOk: boolean;
  refs: RefResult[];
  /** Digest of the received pack, recorded on the push record. */
  packDigest: string;
}

export interface PreReceiveDecision {
  /** Called once git has quarantined the objects; resolves when the decision exists. */
  decide(pushId: string, update: RefUpdate, quarantineDir: string): Promise<RefResult>;
}

export interface ReceivePackRunner {
  run(options: {
    pushId: string;
    mirror: MirrorEntry;
    input: AsyncIterable<Uint8Array>;
    output: (chunk: Uint8Array) => void;
    limits: ParseLimits;
    protocolVersion?: string;
    decision: PreReceiveDecision;
    abort: AbortSignal;
  }): Promise<ReceivePackResult>;
}
