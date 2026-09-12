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
 * Policy decision contract.
 *
 * A decision point receives a read-only view of the submission and returns
 * exactly one verdict. It never receives transport machinery, so the same
 * decision point serves the HTTP relay, the SSH transport and server mode
 * unchanged. It has no side effects; its only output is the verdict and its
 * findings.
 */

import { CommitSummary, Pusher, RefUpdate, RepositoryIdentity, TagSummary } from '../domain';

/** Everything a decision point may read. Complete before any decision point runs. */
export interface Submission {
  id: string;
  repository: RepositoryIdentity;
  refUpdate: RefUpdate;
  pusher: Pusher;
  commits: CommitSummary[];
  tag?: TagSummary;
  /** Access to introduced content, resolved against the mirror so thin packs are complete. */
  content: SubmissionContent;
}

/** Read-only content access. Implementations stream from the quarantined objects. */
export interface SubmissionContent {
  /** Unified diff of the introduced range, bounded by the configured size ceiling. */
  diff(): Promise<string>;
  /** Objects introduced by the push, with sizes, for size and binary checks. */
  introducedObjects(): AsyncIterable<{ oid: string; type: string; size: number }>;
  /** Blob content by object id, bounded by the configured size ceiling. */
  blob(oid: string): Promise<Uint8Array>;
  /** Files changed in the range with their paths, for path-based rules. */
  changedPaths(): Promise<Array<{ path: string; status: 'added' | 'modified' | 'deleted' }>>;
}

export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';

/** Structured evidence. Redaction-safe: a finding locates, it does not quote secret material. */
export interface Finding {
  rule: string;
  severity: Severity;
  message: string;
  locator?: { path?: string; line?: number; oid?: string };
}

/** A check reports on content. It never decides routing. */
export type CheckVerdict =
  | { verdict: 'pass' }
  | { verdict: 'violation'; findings: Finding[] }
  | { verdict: 'could-not-run'; cause: string };

/** A decision hook may additionally route the submission. */
export type DecisionVerdict =
  | CheckVerdict
  | { verdict: 'defer'; reason: string }
  | { verdict: 'allow'; reason: string; matchedRule: string };

export interface Check {
  readonly name: string;
  /** When true, a violation ends evaluation early. Host configuration, not something the submission can influence. */
  readonly terminal?: boolean;
  run(submission: Submission): Promise<CheckVerdict>;
}

export interface DecisionHook {
  readonly name: string;
  run(submission: Submission): Promise<DecisionVerdict>;
}

/** Disposition of a `could-not-run` verdict. Fail-closed unless an operator opts a named decision point out. */
export type CouldNotRunDisposition = 'reject' | 'defer' | 'pass-through';

/** Recorded on the push record for every executed decision point. */
export interface StepResult {
  name: string;
  order: number;
  startedAt: string;
  finishedAt: string;
  outcome: 'passed' | 'violation' | 'could-not-run' | 'defer' | 'allow';
  message: string;
  findings?: Finding[];
  /** The disposition applied when the outcome was could-not-run. */
  couldNotRunDisposition?: CouldNotRunDisposition;
}
