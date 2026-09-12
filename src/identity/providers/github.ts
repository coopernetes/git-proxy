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
 * GitHub identity adapter. Token identity is the reliable signal; the account
 * email is usually hidden by the user and treated as absent.
 */

import { Provider } from '../../domain';
import { CredentialHeaderForm, IdentityProvider, ProviderEndpoints } from './types';

export const CREDENTIAL_FORMS: readonly CredentialHeaderForm[] = [
  { header: 'authorization', scheme: 'Bearer' },
  { header: 'authorization', scheme: 'token' },
  /** git over HTTPS presents the token as the Basic password. */
  { header: 'authorization', scheme: 'Basic' },
];

export const ENDPOINTS: ProviderEndpoints = {
  tokenIdentity: {
    method: 'GET',
    path: '/user',
    notes: 'login is authoritative; email is often empty',
  },
  keyListing: {
    method: 'GET',
    path: '/users/{login}/keys',
    params: ['login'],
    notes: 'public, unauthenticated; no fingerprint field, computed from the raw key',
  },
};

export declare function create(provider: Provider): IdentityProvider;
