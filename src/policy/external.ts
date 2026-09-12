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
 * External decision protocol. Delegates a decision point to a process
 * outside the proxy over HTTP with JSON bodies. The request carries the
 * protocol version and the submission projection, never the client's
 * credential. A response that cannot be parsed, arrives late, or carries a
 * verdict outside the delegate's granted role is could-not-run, so a delegate
 * cannot fail open by being switched off.
 */

import { CheckVerdict, DecisionVerdict, Finding, Submission } from './contract';

export const EXTERNAL_PROTOCOL_VERSION = '1' as const;

export type DelegateRole = 'check' | 'decision-hook';

export interface ExternalDelegateConfig {
  name: string;
  url: string;
  role: DelegateRole;
  timeoutMs: number;
  /** Bearer credential the proxy presents to the delegate; never the pusher's. */
  auth?: { kind: 'bearer'; tokenRef: string };
}

/** Wire request. The submission projection omits content bodies beyond the configured excerpt bound. */
export interface ExternalRequest {
  version: typeof EXTERNAL_PROTOCOL_VERSION;
  submission: Omit<Submission, 'content'> & {
    changedPaths: Array<{ path: string; status: string }>;
  };
}

export interface ExternalResponse {
  version: typeof EXTERNAL_PROTOCOL_VERSION;
  verdict: DecisionVerdict['verdict'];
  findings?: Finding[];
  reason?: string;
  matchedRule?: string;
}

export interface ExternalDelegateClient {
  /** Role check applied to the returned verdict; a check role may not defer or allow. */
  invoke(
    config: ExternalDelegateConfig,
    submission: Submission,
  ): Promise<DecisionVerdict | CheckVerdict>;
}

/**
 * Adapter for policy engines that answer with a decision document rather
 * than the verdict vocabulary. `deny` maps to violation carrying the reasons
 * as findings; `allow` maps to allow for a decision hook and pass for a
 * check; `review` maps to defer. Obligations are recorded as findings of
 * severity info.
 */
export interface DecisionDocument {
  decision: 'allow' | 'deny' | 'review';
  reasons: string[];
  obligations?: string[];
}

export declare function fromDecisionDocument(
  doc: DecisionDocument,
  role: DelegateRole,
): DecisionVerdict;
