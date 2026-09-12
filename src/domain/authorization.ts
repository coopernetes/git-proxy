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
 * Authorization model: capability-set grants on pattern targets, held
 * directly or through groups. Evaluation fails closed: no matching grant
 * means no permission.
 */

/** Atomic abilities. Grants are declared as sets of these. */
export type Capability = 'push' | 'review' | 'self-certify' | 'cancel' | 'fetch';

/** Named grants and the capabilities each carries. Adding a grant is a one-line change here. */
export const GRANTS = {
  PUSH: new Set<Capability>(['push']),
  REVIEW: new Set<Capability>(['review', 'cancel']),
  SELF_CERTIFY: new Set<Capability>(['self-certify']),
  PUSH_AND_REVIEW: new Set<Capability>(['push', 'review', 'cancel']),
  FETCH: new Set<Capability>(['fetch']),
} as const;

export type GrantName = keyof typeof GRANTS;

/** Which part of the repository identity a target pattern is matched against. */
export type TargetKind = 'slug' | 'owner' | 'name';

export type MatchKind = 'literal' | 'glob' | 'regex';

export interface Target {
  kind: TargetKind;
  match: MatchKind;
  /** Matched case-insensitively for every match kind. */
  value: string;
}

export interface Grant {
  id: string;
  grant: GrantName;
  target: Target;
  /** Exactly one of the two. */
  subject: { userId: string } | { groupId: string };
  /** Restrict the grant to one provider; absent means any provider. */
  providerId?: string;
  grantedBy: string;
  grantedAt: string;
}

export interface Group {
  id: string;
  name: string;
  memberIds: string[];
  /** External group this mirrors, when membership is driven by an IdP claim. */
  idpGroup?: string;
}

/** One authorization question. */
export interface AuthorizationQuery {
  userId: string;
  capability: Capability;
  repository: { providerId: string; owner: string; name: string };
}

export interface AuthorizationDecision {
  permitted: boolean;
  /** Grant that satisfied the query; absent on denial. Recorded for audit. */
  matchedGrantId?: string;
}

/** Fail-closed evaluator over the user's direct grants and group grants. */
export interface AuthorizationEvaluator {
  evaluate(query: AuthorizationQuery): Promise<AuthorizationDecision>;
}

/** Whether `holder` carries every capability of `required`. An empty required set is a configuration error, not a match. */
export declare function implies(
  holder: ReadonlySet<Capability>,
  required: ReadonlySet<Capability>,
): boolean;

/**
 * Rules for who may access what without a git push: unauthenticated fetches
 * of public repositories, or a fetch-only deployment. First match wins.
 */
export interface AccessRule {
  id: string;
  order: number;
  effect: 'allow' | 'deny';
  target: Target;
  providerId?: string;
  /** Which services the rule covers. */
  services: Array<'upload-pack' | 'receive-pack'>;
}
