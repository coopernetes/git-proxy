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
 * Types the 2.x dashboard consumes from the former database and processor
 * modules. Retained verbatim so the dashboard keeps compiling while it is
 * re-pointed at the v3 API; nothing outside src/ui may import from here.
 */

import { Question } from '../../config/generated/config';
import { TagData } from '../../types/models';

export type UserRole = 'canPush' | 'canAuthorise';

/** Per-status push counts for a registered repository (matches Activity tabs except `all`). */
export type RepoActivityTabCounts = {
  pending: number;
  approved: number;
  canceled: number;
  rejected: number;
  error: number;
};

export const emptyRepoActivityTabCounts = (): RepoActivityTabCounts => ({
  pending: 0,
  approved: 0,
  canceled: 0,
  rejected: 0,
  error: 0,
});

/** Tab counts and push timestamps keyed by canonical remote URL. */
export type RepoPushRollupsByCanonicalUrl = {
  tabCounts: Map<string, RepoActivityTabCounts>;
  /** Largest `Action.timestamp` (ms) for pushes whose primary Activity tab is `pending`, per URL key. */
  latestPendingReviewAtMs: Map<string, number>;
  /** Largest `Action.timestamp` (ms) over all `type: push` rows per URL key. */
  latestPushAtMs: Map<string, number>;
};

export type PublicKeyRecord = {
  key: string;
  name: string;
  addedAt: string;
  fingerprint: string;
};

export class Repo {
  project: string;
  name: string;
  url: string;
  users: { canPush: string[]; canAuthorise: string[] };
  /**
   * ISO-8601; set on create, never overwritten thereafter.
   * Existing repos missing this field are intentionally left unset here —
   * backfill belongs in a follow-up versioned migration (Mongo: prefer
   * `$toDate: "$_id"` over an epoch default). Do not reintroduce startup
   * one-off backfills.
   */
  dateCreated?: string;
  /**
   * ISO-8601; set on create and bumped on repo metadata mutations.
   * Same migration note as {@link Repo.dateCreated}.
   */
  lastModified?: string;
  _id?: string;
  activity?: RepoActivityTabCounts;
  /** Present when the repo has at least one push currently in the Activity Pending bucket. */
  latestPendingReviewAtMs?: number;
  /** Present when the repo has at least one recorded push in GitProxy. */
  latestPushAtMs?: number;

  constructor(
    project: string,
    name: string,
    url: string,
    users?: Record<UserRole, string[]>,
    _id?: string,
    dateCreated?: string,
    lastModified?: string,
  ) {
    this.project = project;
    this.name = name;
    this.url = url;
    this.users = users ?? { canPush: [], canAuthorise: [] };
    this._id = _id;
    this.dateCreated = dateCreated;
    this.lastModified = lastModified;
  }
}

export interface PublicUser {
  username: string;
  displayName: string;
  email: string;
  title: string;
  gitAccount: string;
  admin: boolean;
  activity?: RepoActivityTabCounts;
  mustChangePassword?: boolean;
}

export interface AttestationAnswer {
  label: string;
  checked: boolean;
}

type AttestationBase = {
  reviewer: {
    username: string;
    email: string;
    /** Optional friendly name; absent on records written by the proxy itself. */
    displayName?: string | null;
    /** Legacy alias for `email` on attestations persisted by older versions. */
    reviewerEmail?: string;
  };
  timestamp: string | Date;
  automated?: boolean;
};

export type Attestation = AttestationBase & {
  questions: Question[];
};

export type CompletedAttestation = AttestationBase & {
  answers: AttestationAnswer[];
};

export type Rejection = AttestationBase & {
  reason: string;
};

export type PersonLine = {
  name: string;
  email: string;
  timestamp: string;
};

export type CommitHeader = {
  tree: string;
  parents: string[];
  author: PersonLine;
  committer: PersonLine;
};

export type CommitData = {
  /** Not derived by `getCommitData`; present only on pushes recorded with a per-commit hash. */
  sha?: string;
  tree: string;
  parent: string;
  author: string;
  committer: string;
  authorEmail: string;
  committerEmail: string;
  commitTimestamp: string;
  message: string;
};

/** Per-check result as serialised on a 2.x push record. */
export interface StepData {
  id: string;
  stepName: string;
  content: any;
  error: boolean;
  errorMessage: string | null;
  blocked: boolean;
  blockedMessage: string | null;
  logs: string[];
}

/** The JSON shape of a 2.x push record as returned by the service API. */
export interface ActionData {
  id: string;
  type: RequestType;
  actionType?: PushType;
  method: string;
  timestamp: number;
  project: string;
  repoName: string;
  url: string;
  repo: string;
  steps: StepData[];
  error: boolean;
  errorMessage?: string | null;
  blocked: boolean;
  blockedMessage?: string | null;
  allowPush: boolean;
  authorised: boolean;
  canceled: boolean;
  rejected: boolean;
  autoApproved: boolean;
  autoRejected: boolean;
  commitData?: CommitData[];
  commitFrom?: string;
  commitTo?: string;
  branch?: string;
  message?: string;
  author?: string;
  user?: string;
  userEmail?: string;
  attestation?: CompletedAttestation;
  rejection?: Rejection;
  lastStep?: StepData;
  proxyGitPath?: string;
  tags?: string[];
  tagData?: TagData[];
  newIdxFiles?: string[];
  protocol?: 'https' | 'ssh';
  capabilities?: string[];
  pullAuthStrategy?:
    'basic' | 'ssh-user-key' | 'ssh-service-token' | 'ssh-agent-forwarding' | 'anonymous';
}

export enum RequestType {
  PUSH = 'push',
  PULL = 'pull',
  DEFAULT = 'default',
}

export enum PushType {
  TAG = 'tag',
  BRANCH = 'branch',
}
