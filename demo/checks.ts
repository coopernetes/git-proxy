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
 * Mock decision points for the demo. They implement the real contract
 * (submission view in, one verdict out) against a reduced submission that
 * carries only what the demo enumerates from the quarantine.
 */

import { Check, CheckVerdict, Finding, StepResult } from '../src/policy/contract';
import { CommitSummary } from '../src/domain';

export interface DemoSubmission {
  id: string;
  ref: string;
  oldOid: string;
  newOid: string;
  pusher: { username: string; emails: string[] };
  commits: CommitSummary[];
  objectCount: number;
}

type DemoCheck = Omit<Check, 'run'> & {
  run(s: DemoSubmission): Promise<CheckVerdict>;
  label: string;
};

const finding = (
  rule: string,
  severity: Finding['severity'],
  message: string,
  oid?: string,
): Finding => ({
  rule,
  severity,
  message,
  locator: oid ? { oid } : undefined,
});

export const reachability: DemoCheck = {
  name: 'reachability',
  label: `${'reachability'.padEnd(20)}`,
  terminal: true,
  async run(s) {
    // The demo enumerates objects with rev-list from the quarantine, so everything it sees is reachable by construction.
    return s.objectCount > 0 || s.newOid === '0'.repeat(s.oldOid.length)
      ? { verdict: 'pass' }
      : { verdict: 'could-not-run', cause: 'reachable set is empty' };
  },
};

export const commitMessages: DemoCheck = {
  name: 'commit-messages',
  label: 'commit-messages'.padEnd(20),
  async run(s) {
    const bad = s.commits.filter((c) => /^wip\b/i.test(c.message));
    return bad.length
      ? {
          verdict: 'violation',
          findings: bad.map((c) =>
            finding('message.block.literal', 'medium', `message starts with "WIP"`, c.oid),
          ),
        }
      : { verdict: 'pass' };
  },
};

export const authorAttribution: DemoCheck = {
  name: 'author-attribution',
  label: 'author-attribution'.padEnd(20),
  async run(s) {
    const unregistered = [
      ...new Set(
        s.commits
          .filter((c) => !s.pusher.emails.includes(c.author.email))
          .map((c) => c.author.email),
      ),
    ];
    if (!unregistered.length) return { verdict: 'pass' };
    const shown = unregistered.slice(0, 3).join(', ');
    const more = unregistered.length > 3 ? ` and ${unregistered.length - 3} more` : '';
    // Advisory: the demo reports and passes; an enforce mode would return a violation.
    return {
      verdict: 'pass',
      advisory: [
        `author email${unregistered.length > 1 ? 's' : ''} not registered to ${s.pusher.username}: ${shown}${more}`,
      ],
    } as CheckVerdict & { advisory: string[] };
  },
};

export const secrets: DemoCheck = {
  name: 'secrets',
  label: 'secrets'.padEnd(20),
  async run() {
    // Deliberately could-not-run to show the fail-closed disposition on the wire and on the record.
    return { verdict: 'could-not-run', cause: 'scanner not configured in the demo' };
  },
};

export const CHECKS: DemoCheck[] = [reachability, commitMessages, authorAttribution, secrets];

export interface Evaluation {
  steps: StepResult[];
  outcome: 'rejected' | 'pending';
  summary: string;
  lines: string[];
}

/** Runs every check, streams a line per check through `emit`, and derives the disposition. */
export async function evaluate(
  s: DemoSubmission,
  emit: (line: string) => void,
): Promise<Evaluation> {
  const steps: StepResult[] = [];
  const lines: string[] = [];
  let violation: Finding | undefined;
  let couldNotRun = false;
  const say = (l: string) => {
    lines.push(l);
    emit(l);
  };
  for (const [i, check] of CHECKS.entries()) {
    const startedAt = new Date().toISOString();
    const v = await check.run(s);
    const finishedAt = new Date().toISOString();
    const advisory = (v as { advisory?: string[] }).advisory;
    let message: string;
    if (v.verdict === 'pass') {
      message = advisory
        ? `advisory: ${advisory.join('; ')}`
        : check.name === 'reachability'
          ? `${s.objectCount} objects, ${s.commits.length} commits reachable from ${s.ref}`
          : 'ok';
      say(`  ${advisory ? '!' : '✓'} ${check.label} ${message}`);
    } else if (v.verdict === 'violation') {
      message = v.findings
        .map((f) => `${f.message}${f.locator?.oid ? ` (${f.locator.oid.slice(0, 8)})` : ''}`)
        .join('; ');
      violation ??= v.findings[0];
      say(`  ✗ ${check.label} ${message}`);
    } else {
      message = `could not run: ${v.cause} → defer (fail closed)`;
      couldNotRun = true;
      say(`  - ${check.label} ${message}`);
    }
    steps.push({
      name: check.name,
      order: i,
      startedAt,
      finishedAt,
      outcome:
        v.verdict === 'pass' ? 'passed' : v.verdict === 'violation' ? 'violation' : 'could-not-run',
      message,
      findings: v.verdict === 'violation' ? v.findings : undefined,
      couldNotRunDisposition: v.verdict === 'could-not-run' ? 'defer' : undefined,
    });
    if (v.verdict === 'violation' && check.terminal) break;
  }
  if (violation)
    return { steps, outcome: 'rejected', summary: `policy violation: ${violation.message}`, lines };
  return {
    steps,
    outcome: 'pending',
    summary: couldNotRun ? 'review required (a check could not run)' : 'review required',
    lines,
  };
}
