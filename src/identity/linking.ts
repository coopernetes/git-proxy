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
 * Account linking. An out-of-band, browser-based flow in which a signed-in
 * user proves ownership of an upstream account. The result is a verified
 * ScmIdentity and, optionally, the account's keys imported with provider
 * provenance, which is what lets a later SSH push resolve.
 *
 * Any token material retained from the flow is encrypted at rest with a key
 * supplied by configuration, is scoped to identity operations, and is never
 * used as a git push credential.
 */

import { ScmIdentity, SshKey } from '../domain';

export interface LinkStart {
  /** Where the browser is sent. */
  authorizationUrl: string;
  /** Opaque, single-use, bound to the session; validated on callback. */
  state: string;
}

export interface LinkResult {
  identity: ScmIdentity;
  importedKeys: SshKey[];
}

export interface AccountLinkFlow {
  readonly providerId: string;
  start(userId: string): Promise<LinkStart>;
  /** Validates state, exchanges the code, resolves the account, records the identity and keys. */
  callback(userId: string, state: string, code: string): Promise<LinkResult>;
  unlink(userId: string, providerId: string): Promise<void>;
}

/** Encrypted-at-rest storage for retained link tokens. Callers never see plaintext outside a provider call. */
export interface LinkTokenVault {
  put(userId: string, providerId: string, plaintext: string): Promise<void>;
  /** Used only to call the provider's identity API on the user's behalf. */
  withToken<T>(userId: string, providerId: string, use: (token: string) => Promise<T>): Promise<T>;
  delete(userId: string, providerId: string): Promise<void>;
}

export interface LinkingConfig {
  /** Key used for at-rest encryption of link tokens; absence disables retention. */
  encryptionKey?: string;
  /** Whether the flow imports the account's keys on link. */
  importKeys: boolean;
}
