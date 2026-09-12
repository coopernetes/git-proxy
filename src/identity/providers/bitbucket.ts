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
 * Bitbucket identity adapter. Token identity only; there is no public key
 * listing, so SSH pushes cannot be resolved by key and stay unconfirmed.
 *
 * Credential-form constraint: the git endpoint does not accept the account
 * email as the Basic username and requires the account's generated username.
 * The forwarding layer rewrites the username element of the forwarded Basic
 * credential from email to that username after resolution. This is the one
 * documented case where a client credential header is not relayed verbatim.
 */

import { Provider } from '../../domain';
import { CredentialHeaderForm, IdentityProvider, ProviderEndpoints } from './types';

export const CREDENTIAL_FORMS: readonly CredentialHeaderForm[] = [
  { header: 'authorization', scheme: 'Bearer' },
  { header: 'authorization', scheme: 'Basic' },
];

export const ENDPOINTS: ProviderEndpoints = {
  tokenIdentity: {
    method: 'GET',
    path: '/2.0/user',
    notes: 'returns the generated username the git endpoint requires as the credential username',
  },
};

export const CREDENTIAL_FORM_CONSTRAINT = {
  rewrite: 'basic-username',
  from: 'account email',
  to: 'account username from token identity',
} as const;

export declare function create(provider: Provider): IdentityProvider;
