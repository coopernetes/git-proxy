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
 * Identity provider adapter. Wraps the platform's identity API for the two
 * capability-conditional operations the resolver needs. A credential is read
 * here for identity only; the request that carried it is forwarded with the
 * credential header unchanged, except where a provider's documented
 * credential-form constraint requires a rewrite.
 */

import { Provider, ProviderCapabilities, ProviderKind } from '../../domain';

/** Reported when the provider does not offer the capability. Distinct from an error: nothing was attempted. */
export type Unsupported = 'unsupported';

export interface ResolvedAccount {
  login: string;
  externalId?: string;
  /** Account email as the platform reports it; frequently absent and never an access signal. */
  email?: string;
}

export interface ListedKey {
  publicKey: string;
  algorithm: string;
  fingerprint: string;
  title?: string;
}

/** How a client presents its credential to this provider, for identity extraction only. */
export interface CredentialHeaderForm {
  header: string;
  /** Scheme prefix within the header value, when one applies. */
  scheme?: string;
}

/** Endpoint the adapter uses for a capability, relative to the provider's api base. */
export interface EndpointDescriptor {
  method: 'GET';
  path: string;
  /** Path parameters the adapter must supply. */
  params?: string[];
  notes?: string;
}

export interface ProviderEndpoints {
  tokenIdentity?: EndpointDescriptor;
  /** Lists a named account's keys; confirms rather than discovers, so a login is an input. */
  keyListing?: EndpointDescriptor;
  /** Second step where key listing needs the account's numeric id first. */
  keyListingLookup?: EndpointDescriptor;
}

export interface IdentityProvider {
  readonly kind: ProviderKind;
  readonly capabilities: ProviderCapabilities;
  readonly credentialForms: CredentialHeaderForm[];
  readonly endpoints: ProviderEndpoints;
  /** Resolves a presented token to the account it belongs to. Network or auth failure throws; the resolver maps it to unconfirmed. */
  tokenIdentity(token: string): Promise<ResolvedAccount | Unsupported>;
  /** Lists the registered keys of a named account. */
  listKeys(login: string): Promise<ListedKey[] | Unsupported>;
}

export type IdentityProviderFactory = (provider: Provider) => IdentityProvider;
