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
 * Identity model.
 *
 * Two unrelated kinds of identity travel with a push and are kept apart on
 * purpose:
 *
 * - The pusher: the principal authenticated on the connection to the proxy,
 *   anchored to the credential the client proved possession of. This is the
 *   only identity that carries authorization weight.
 * - Commit metadata: author and committer lines inside commit objects. These
 *   are self-asserted, unauthenticated content and are never used for an
 *   authorization or approval decision.
 */

export type ProviderKind = 'github' | 'gitlab' | 'forgejo' | 'bitbucket' | 'generic';

/** A configured upstream host. Referenced by id from every record that names a provider. */
export interface Provider {
  id: string;
  kind: ProviderKind;
  /** Base URL of the git endpoint, e.g. https://github.com */
  gitUrl: string;
  /** Base URL of the identity API where the platform offers one. */
  apiUrl?: string;
  /** Which identity resolution capabilities this provider offers. */
  capabilities: ProviderCapabilities;
}

export interface ProviderCapabilities {
  /** Maps a presented token to the account it belongs to. */
  tokenIdentity: boolean;
  /** Lists a named account's registered SSH public keys. */
  keyIdentity: boolean;
  /** Offers an out-of-band flow in which a user proves ownership of an upstream account. */
  accountLinking: boolean;
}

/** How a fact about an identity came to be known. */
export type VerificationSource =
  'provider-token' | 'provider-key-listing' | 'account-link' | 'idp' | 'admin' | 'self-declared';

/** A verified or claimed email address belonging to a user. */
export interface UserEmail {
  address: string;
  verified: boolean;
  source: VerificationSource;
  primary: boolean;
}

/** One account on one upstream. A user may hold several, on several providers. */
export interface ScmIdentity {
  providerId: string;
  /** The platform login as the platform reports it. */
  login: string;
  /** Platform-side stable identifier where one exists. */
  externalId?: string;
  verified: boolean;
  source: VerificationSource;
}

/** An SSH public key with provenance. */
export interface SshKey {
  fingerprint: string;
  algorithm: string;
  publicKey: string;
  addedAt: string;
  /** Who vouched for this key belonging to the user. */
  source: VerificationSource;
  /** Provider that attested the key, when the source is a provider. */
  providerId?: string;
}

export type UserRole = 'user' | 'reviewer' | 'admin';

/** A user of the proxy. Authentication to the dashboard is a separate concern. */
export interface User {
  id: string;
  username: string;
  displayName?: string;
  roles: UserRole[];
  emails: UserEmail[];
  scmIdentities: ScmIdentity[];
  sshKeys: SshKey[];
  /** Subject of the dashboard IdP where the user was provisioned by one. */
  idpSubject?: string;
  createdAt: string;
  updatedAt: string;
}

/** The credential the client authenticated with on the connection to the proxy. */
export type CredentialAnchor =
  | {
      kind: 'token';
      providerId: string;
      /** Digest of the token, never the token. */ digest: string;
    }
  | { kind: 'ssh-key'; fingerprint: string }
  | { kind: 'oidc'; issuer: string; subject: string };

/**
 * Degree of positive confirmation behind a resolved pusher. These are levels
 * of confirmation, not levels of suspicion: a resolution that contradicts a
 * claim is a hard rejection, never a low level.
 */
export type AssuranceLevel =
  /** Credential accepted upstream but no account could be resolved (no identity API, or unreachable). */
  | 'unconfirmed'
  /** The provider resolved the credential to a login that matches a registered identity. */
  | 'confirmed'
  /** The link between user and upstream account was attested by an account-linking flow. */
  | 'verified';

/** The pusher, as established for one submission. */
export interface Pusher {
  anchor: CredentialAnchor;
  /** Identifier the client presented (HTTP Basic username, SSH login). Recorded, never trusted. */
  presented?: string;
  /** Upstream account resolved from the credential, when the provider offers that capability. */
  resolved?: { providerId: string; login: string };
  /** Proxy user the resolved account maps to, when a mapping exists. */
  userId?: string;
  assurance: AssuranceLevel;
}
