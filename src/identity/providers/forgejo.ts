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
 * Forgejo and Gitea identity adapter. One adapter covers both; the API
 * surface is shared. Key listing returns a fingerprint field, which is
 * recomputed from the raw key for consistency with other providers.
 */

import { Provider } from '../../domain';
import { CredentialHeaderForm, IdentityProvider, ProviderEndpoints } from './types';

export const CREDENTIAL_FORMS: readonly CredentialHeaderForm[] = [
  { header: 'authorization', scheme: 'token' },
  { header: 'authorization', scheme: 'Bearer' },
  { header: 'authorization', scheme: 'Basic' },
];

export const ENDPOINTS: ProviderEndpoints = {
  tokenIdentity: { method: 'GET', path: '/api/v1/user', notes: 'login and email' },
  keyListing: { method: 'GET', path: '/api/v1/users/{login}/keys', params: ['login'] },
};

export declare function create(provider: Provider): IdentityProvider;
