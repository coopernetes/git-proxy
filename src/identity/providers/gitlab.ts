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
 * GitLab identity adapter. Key listing is two-step: username to numeric id,
 * then the id's keys. Namespaces nest, so the owner element of a repository
 * identity may span several path segments.
 */

import { Provider } from '../../domain';
import { CredentialHeaderForm, IdentityProvider, ProviderEndpoints } from './types';

export const CREDENTIAL_FORMS: readonly CredentialHeaderForm[] = [
  { header: 'private-token' },
  { header: 'authorization', scheme: 'Bearer' },
  { header: 'authorization', scheme: 'Basic' },
];

export const ENDPOINTS: ProviderEndpoints = {
  tokenIdentity: { method: 'GET', path: '/api/v4/user', notes: 'username and primary email' },
  keyListingLookup: {
    method: 'GET',
    path: '/api/v4/users',
    params: ['username'],
    notes: 'resolves username to id',
  },
  keyListing: { method: 'GET', path: '/api/v4/users/{id}/keys', params: ['id'] },
};

export declare function create(provider: Provider): IdentityProvider;
