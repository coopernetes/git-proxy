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
 * File-backed store on NeDB. One datastore per aggregate. Suitable for a
 * single instance; it holds no locks across processes. It cannot join, so a
 * user's effective grants are two lookups: direct grants, then grants held
 * by the groups the user belongs to.
 */

import { Stores } from '../spi';

export interface FileStoreOptions {
  /** Directory holding one .db file per aggregate. */
  directory: string;
}

export const DATASTORES = [
  'users',
  'localCredentials',
  'groups',
  'grants',
  'accessRules',
  'repositories',
  'pushes',
  'audit',
  'adminAudit',
  'fetches',
  'sessions',
  'migrations',
] as const;

export type DatastoreName = (typeof DATASTORES)[number];

export interface IndexSpec {
  datastore: DatastoreName;
  fieldName: string;
  unique: boolean;
}

/** Declared at open; ensured before the store is handed out. */
export const INDEXES: readonly IndexSpec[] = [
  { datastore: 'users', fieldName: 'username', unique: true },
  { datastore: 'users', fieldName: 'idpSubject', unique: false },
  { datastore: 'users', fieldName: 'scmIdentityKeys', unique: true },
  { datastore: 'users', fieldName: 'sshFingerprints', unique: true },
  { datastore: 'users', fieldName: 'emailAddresses', unique: false },
  { datastore: 'localCredentials', fieldName: 'userId', unique: true },
  { datastore: 'groups', fieldName: 'memberIds', unique: false },
  { datastore: 'grants', fieldName: 'subjectKey', unique: false },
  { datastore: 'repositories', fieldName: 'slugKey', unique: true },
  { datastore: 'pushes', fieldName: 'state', unique: false },
  { datastore: 'pushes', fieldName: 'receivedAt', unique: false },
  { datastore: 'pushes', fieldName: 'repositorySlug', unique: false },
  { datastore: 'pushes', fieldName: 'approvalBindingKey', unique: false },
  { datastore: 'audit', fieldName: 'pushId', unique: false },
  { datastore: 'sessions', fieldName: 'expiresAt', unique: false },
];

/**
 * Derived key fields written alongside each document so the flat indexes
 * above can answer the SPI queries: `scmIdentityKeys` = `providerId:login`
 * per identity, `sshFingerprints`, `emailAddresses`, `subjectKey` =
 * `user:<id>` or `group:<id>`, `slugKey` = `providerId/owner/name`,
 * `approvalBindingKey` = `slug|ref|old|new|packDigest`.
 */
export type DerivedKeys = Record<string, string | string[]>;

export declare function createFileStores(options: FileStoreOptions): Promise<Stores>;
