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
 * Store composition root. Selects a backend from configuration and hands out
 * the bundle; the process holds exactly one bundle.
 */

import { StoreKind, Stores, UserStore } from './spi';
import { FileStoreOptions } from './file';
import { MongoStoreOptions } from './mongo';

export * from './spi';
export * from './query';
export { createFileStores } from './file';
export { createMongoStores } from './mongo';
export * from './migrations/registry';

export type StoreConfig =
  { kind: 'file'; file: FileStoreOptions } | { kind: 'mongo'; mongo: MongoStoreOptions };

export declare function createStores(config: StoreConfig): Promise<Stores>;

/** The process-wide bundle after startup; throws before it. */
export declare function getStores(): Stores;

export declare function getUserStore(): UserStore;

export declare function storeKind(): StoreKind;
