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
 * Store service provider interfaces. One narrow interface per aggregate,
 * carrying only the queries the engine and the API need, so that a backend
 * that cannot join can still implement every method with indexed lookups.
 * Every implementation is fail-closed: a lookup that errors is an error,
 * never an empty result.
 */

import {
  AccessRule,
  AdminAuditEvent,
  ApprovalBinding,
  AuditEvent,
  FetchRecord,
  Grant,
  Group,
  Provider,
  PushRecord,
  RegisteredRepository,
  RepositoryIdentity,
  User,
  UserRole,
} from '../domain';
import { Transition } from '../domain/lifecycle';
import { Page, PageRequest, PushQuery } from './query';

export type StoreKind = 'file' | 'mongo';

/** Fields the dashboard IdP supplies on login; roles are persisted as granted, never re-derived. */
export interface IdpProvisioning {
  username: string;
  idpSubject: string;
  email?: string;
  displayName?: string;
  roles: UserRole[];
}

export interface UserStore {
  byId(id: string): Promise<User | undefined>;
  byUsername(username: string): Promise<User | undefined>;
  byIdpSubject(subject: string): Promise<User | undefined>;
  byScmIdentity(providerId: string, login: string): Promise<User | undefined>;
  bySshFingerprint(fingerprint: string): Promise<User | undefined>;
  /** An address may be registered by several users; callers decide what that means. */
  byEmail(address: string): Promise<User[]>;
  upsertFromIdp(provisioning: IdpProvisioning): Promise<User>;
  create(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User>;
  update(id: string, patch: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User>;
  delete(id: string): Promise<void>;
  list(page: PageRequest): Promise<Page<User>>;
}

/** Local (password) authentication material, kept apart from the user record. */
export interface LocalCredential {
  userId: string;
  passwordHash: string;
  mustChangePassword: boolean;
}

export interface LocalCredentialStore {
  byUserId(userId: string): Promise<LocalCredential | undefined>;
  set(credential: LocalCredential): Promise<void>;
  delete(userId: string): Promise<void>;
}

export interface GroupStore {
  byId(id: string): Promise<Group | undefined>;
  forMember(userId: string): Promise<Group[]>;
  create(group: Omit<Group, 'id'>): Promise<Group>;
  update(id: string, patch: Partial<Omit<Group, 'id'>>): Promise<Group>;
  delete(id: string): Promise<void>;
  list(page: PageRequest): Promise<Page<Group>>;
}

export interface GrantStore {
  forUser(userId: string): Promise<Grant[]>;
  forGroups(groupIds: string[]): Promise<Grant[]>;
  byTarget(target: Grant['target'], providerId?: string): Promise<Grant[]>;
  create(grant: Omit<Grant, 'id'>): Promise<Grant>;
  delete(id: string): Promise<void>;
  list(page: PageRequest): Promise<Page<Grant>>;
}

export interface AccessRuleStore {
  /** In evaluation order. */
  all(): Promise<AccessRule[]>;
  create(rule: Omit<AccessRule, 'id'>): Promise<AccessRule>;
  update(id: string, patch: Partial<Omit<AccessRule, 'id'>>): Promise<AccessRule>;
  delete(id: string): Promise<void>;
}

export interface RepositoryStore {
  byIdentity(identity: RepositoryIdentity): Promise<RegisteredRepository | undefined>;
  byId(id: string): Promise<RegisteredRepository | undefined>;
  list(page: PageRequest, providerId?: string): Promise<Page<RegisteredRepository>>;
  register(
    repo: Omit<RegisteredRepository, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<RegisteredRepository>;
  remove(id: string): Promise<void>;
}

/** Providers come from configuration and are read-only at runtime. */
export interface ProviderStore {
  byId(id: string): Promise<Provider | undefined>;
  all(): Promise<Provider[]>;
}

export interface PushStore {
  /** Assigns the id; the caller never supplies one. */
  create(record: Omit<PushRecord, 'id'>): Promise<PushRecord>;
  get(id: string): Promise<PushRecord | undefined>;
  /** Applies a lifecycle transition atomically against the record's current state; refuses a stale state. */
  transition(id: string, expectedState: PushRecord['state'], next: Transition): Promise<PushRecord>;
  list(query: PushQuery, page: PageRequest): Promise<Page<PushRecord>>;
  /** An `approved` record matching every element of the binding that has not been consumed. */
  findApproval(binding: ApprovalBinding): Promise<PushRecord | undefined>;
  /** Marks the approval used so a second retry cannot reuse it. */
  consumeApproval(id: string): Promise<void>;
  /** Pending records older than the cutoff, for the review-window sweep. */
  expirePending(olderThan: string): Promise<PushRecord[]>;
  /** Unconsumed approvals older than the cutoff. */
  expireApprovals(olderThan: string): Promise<PushRecord[]>;
}

export interface AuditStore {
  append(event: AuditEvent): Promise<void>;
  listForPush(pushId: string): Promise<AuditEvent[]>;
  appendAdmin(event: AdminAuditEvent): Promise<void>;
  listAdmin(page: PageRequest): Promise<Page<AdminAuditEvent>>;
}

export interface FetchRecordStore {
  append(record: FetchRecord): Promise<void>;
  list(page: PageRequest): Promise<Page<FetchRecord>>;
}

/** Backing store for express-session; connect-mongo or an NeDB-backed store. */
export interface SessionStore {
  /** The express-session compatible store instance. */
  readonly expressStore: unknown;
}

export interface Stores {
  readonly kind: StoreKind;
  users: UserStore;
  localCredentials: LocalCredentialStore;
  groups: GroupStore;
  grants: GrantStore;
  accessRules: AccessRuleStore;
  repositories: RepositoryStore;
  providers: ProviderStore;
  pushes: PushStore;
  audit: AuditStore;
  fetches: FetchRecordStore;
  sessions: SessionStore;
  close(): Promise<void>;
}

export interface StoreFactory {
  readonly kind: StoreKind;
  create(): Promise<Stores>;
}
