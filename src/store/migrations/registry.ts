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
 * Versioned schema migrations. Each migration is applied once per database
 * and recorded; the record is checked at startup and a store behind the
 * expected version refuses to open. Migrations are forward-only.
 */

import { StoreKind, Stores } from '../spi';

export interface Migration {
  /** Zero-padded sequence plus slug, e.g. `0001-initial-v3`; ordering is lexical. */
  id: string;
  description: string;
  /** One step per store kind; a kind with no entry has nothing to do for this migration. */
  up: Partial<Record<StoreKind, (stores: Stores) => Promise<void>>>;
}

export interface AppliedMigration {
  id: string;
  appliedAt: string;
}

export interface MigrationRegistry {
  readonly migrations: readonly Migration[];
  applied(stores: Stores): Promise<AppliedMigration[]>;
  /** Applies every unapplied migration up to and including `target`, in order. */
  migrate(stores: Stores, target?: string): Promise<AppliedMigration[]>;
}

/**
 * The v3 target shape. Users carry emails, provider-tagged identities and
 * keys with provenance; access is grants on targets held by users or groups;
 * a push record has an assigned id, one canonical state and an explicit
 * audit log. There is no in-place upgrade path from earlier record shapes
 * within this migration; earlier data is imported, not converted.
 */
export const INITIAL_V3: Migration = {
  id: '0001-initial-v3',
  description: 'Create v3 aggregates and ensure their indexes',
  up: {},
};

export const MIGRATIONS: readonly Migration[] = [INITIAL_V3];

export declare function migrate(stores: Stores, target?: string): Promise<AppliedMigration[]>;
