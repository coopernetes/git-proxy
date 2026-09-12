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
 * The decision host. Runs every applicable check, collects all verdicts so a
 * submission's complete set of findings is reported at once, then derives
 * one disposition. Parsing, identity resolution and commit enrichment are
 * complete before the first decision point runs; extension decision points
 * run after the built-in ones.
 */

import { Check, CouldNotRunDisposition, DecisionHook, StepResult, Submission } from './contract';

export type Disposition =
  | { outcome: 'rejected'; steps: StepResult[]; summary: string }
  | { outcome: 'pending'; steps: StepResult[]; summary: string }
  | { outcome: 'allow'; steps: StepResult[]; matchedRule: string }
  | { outcome: 'error'; steps: StepResult[]; cause: string };

export interface DecisionHostConfig {
  /** Default for a could-not-run verdict. */
  couldNotRun: CouldNotRunDisposition;
  /** Explicit, visible per-decision-point overrides. */
  couldNotRunOverrides: Record<string, CouldNotRunDisposition>;
  /** Rules whose violations route to review instead of rejecting outright. */
  reviewableRules: string[];
}

export interface DecisionHost {
  /** Built-in checks first, then extension checks, then decision hooks. */
  register(point: Check | DecisionHook, origin: 'builtin' | 'plugin'): void;
  evaluate(submission: Submission): Promise<Disposition>;
}

/**
 * Derivation rules, in order:
 * 1. any could-not-run: apply its disposition; pass-through is recorded as such, never as pass
 * 2. any violation not routed to review, with no overriding allow: rejected
 * 3. an allow from a decision hook: eligible to bypass review, subject to self-approval rules
 * 4. otherwise: pending
 */
export declare function derive(steps: StepResult[], config: DecisionHostConfig): Disposition;
