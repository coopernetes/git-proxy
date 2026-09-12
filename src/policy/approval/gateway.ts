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
 * Approval gateway. Decides what happens to a submission that evaluation
 * left pending: approve it by rule, reject it by rule, or hold it for a
 * reviewer. Every outcome is attested; automated ones carry the automated
 * actor type and the matched rule.
 */

import { Attestation, PushRecord } from '../../domain';

export type GatewayOutcome =
  | { outcome: 'auto-approve'; attestation: Attestation }
  | { outcome: 'auto-reject'; attestation: Attestation }
  | { outcome: 'await-review' };

export interface ApprovalGateway {
  readonly name: 'auto' | 'review' | 'external';
  decide(record: PushRecord): Promise<GatewayOutcome>;
}

export interface AutoGatewayConfig {
  /** Rules matched against the record; first match wins. */
  rules: Array<{
    name: string;
    effect: 'approve' | 'reject';
    /** Repository target in the authorization model's pattern form. */
    target: { kind: 'slug' | 'owner' | 'name'; match: 'literal' | 'glob' | 'regex'; value: string };
    /** Ref name glob, e.g. refs/heads/release/*. */
    ref?: string;
    /** Require every step outcome to be passed. Default true for approve rules. */
    requireCleanSteps?: boolean;
  }>;
}

/** Rule-driven approval or rejection from configuration. */
export declare const autoGateway: ApprovalGateway;

/** Holds the submission for a dashboard reviewer. */
export declare const reviewGateway: ApprovalGateway;

/** Delegates the decision over the external decision protocol. */
export declare const externalGateway: ApprovalGateway;

/** Which gateway governs a repository; a per-repository selection overrides the global one. */
export interface GatewaySelection {
  default: ApprovalGateway['name'];
  perRepository: Array<{ slug: string; gateway: ApprovalGateway['name'] }>;
}
