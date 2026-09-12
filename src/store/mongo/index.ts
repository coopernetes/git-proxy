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
 * MongoDB-backed store. Every SPI query is served by a declared index; the
 * index table is ensured at open, so a missing index is a startup failure
 * rather than a collection scan in production.
 */

import { Stores } from '../spi';

export interface MongoStoreOptions {
  connectionString: string;
  databaseName?: string;
}

export const COLLECTIONS = {
  users: 'users',
  localCredentials: 'local_credentials',
  groups: 'groups',
  grants: 'grants',
  accessRules: 'access_rules',
  repositories: 'repositories',
  pushes: 'pushes',
  audit: 'push_audit',
  adminAudit: 'admin_audit',
  fetches: 'fetch_records',
  sessions: 'sessions',
  migrations: 'migrations',
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

export interface MongoIndexSpec {
  collection: CollectionName;
  keys: Record<string, 1 | -1>;
  unique?: boolean;
  /** Seconds; sessions expire in the database, not by a sweep. */
  expireAfterSeconds?: number;
}

export const INDEXES: readonly MongoIndexSpec[] = [
  { collection: 'users', keys: { username: 1 }, unique: true },
  { collection: 'users', keys: { idpSubject: 1 } },
  {
    collection: 'users',
    keys: { 'scmIdentities.providerId': 1, 'scmIdentities.login': 1 },
    unique: true,
  },
  { collection: 'users', keys: { 'sshKeys.fingerprint': 1 }, unique: true },
  { collection: 'users', keys: { 'emails.address': 1 } },
  { collection: 'local_credentials', keys: { userId: 1 }, unique: true },
  { collection: 'groups', keys: { memberIds: 1 } },
  { collection: 'grants', keys: { 'subject.userId': 1 } },
  { collection: 'grants', keys: { 'subject.groupId': 1 } },
  { collection: 'grants', keys: { 'target.kind': 1, 'target.value': 1, providerId: 1 } },
  { collection: 'access_rules', keys: { order: 1 } },
  {
    collection: 'repositories',
    keys: { 'identity.providerId': 1, 'identity.owner': 1, 'identity.name': 1 },
    unique: true,
  },
  { collection: 'pushes', keys: { state: 1, receivedAt: -1 } },
  {
    collection: 'pushes',
    keys: {
      'repository.providerId': 1,
      'repository.owner': 1,
      'repository.name': 1,
      receivedAt: -1,
    },
  },
  { collection: 'pushes', keys: { 'pusher.userId': 1, receivedAt: -1 } },
  {
    collection: 'pushes',
    keys: {
      state: 1,
      'repository.providerId': 1,
      'repository.owner': 1,
      'repository.name': 1,
      'refUpdate.ref': 1,
      'refUpdate.oldOid': 1,
      'refUpdate.newOid': 1,
    },
  },
  { collection: 'push_audit', keys: { pushId: 1, occurredAt: 1 } },
  { collection: 'admin_audit', keys: { occurredAt: -1 } },
  { collection: 'fetch_records', keys: { occurredAt: -1 } },
  { collection: 'sessions', keys: { expires: 1 }, expireAfterSeconds: 0 },
];

export declare function createMongoStores(options: MongoStoreOptions): Promise<Stores>;
