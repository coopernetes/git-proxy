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
 * Pusher resolution. Establishes whose push a submission is from the
 * credential the client proved possession of, never from a name the client
 * typed. The presented identifier is recorded for audit and carries no
 * weight.
 *
 * The ladder, in order:
 *
 * - token: presented token → provider identity API → login → registered
 *   ScmIdentity for that provider → proxy user.
 * - ssh key: connecting key → fingerprint → registered SshKey whose source is
 *   provider-attested or link-imported → proxy user. A key alone cannot be
 *   reversed to an account, so an unlinked first-time key resolves to nothing.
 *
 * Outcomes:
 *
 * - The provider offers no identity API, or it is unreachable: the pusher is
 *   credential-anchored but unresolved, `assurance: 'unconfirmed'`. The
 *   presented name is never substituted for the missing account.
 * - The provider resolved a login that matches a registered identity:
 *   `confirmed`; `verified` when that identity was attested by an account link.
 * - The provider resolved a login that contradicts a registered identity for
 *   the same credential: a hard failure. A contradiction is not a lower level.
 */

import { CredentialAnchor, Pusher } from '../domain';

export class IdentityContradictionError extends Error {
  constructor(
    readonly providerId: string,
    readonly resolvedLogin: string,
    readonly registeredLogin: string,
  ) {
    super('resolved identity contradicts the registered identity for this credential');
  }
}

export interface PusherResolver {
  /**
   * @param anchor the credential the client authenticated with
   * @param providerId the provider the request is addressed to
   * @param presented the identifier the client presented, recorded only
   */
  resolve(anchor: CredentialAnchor, providerId: string, presented?: string): Promise<Pusher>;
}

/** A cached resolution: what a credential digest resolved to, and when that stops being trusted. */
export interface CachedResolution {
  providerId: string;
  login: string;
  externalId?: string;
  resolvedAt: number;
  expiresAt: number;
}

/**
 * Bounded, TTL-keyed cache of provider resolutions. Keyed by credential
 * digest, never by token. Expired and excess entries are evicted on insert;
 * there is no background scheduler. A cache miss or expiry is a fresh
 * provider call, never a fallback to the presented name.
 */
export interface ResolutionCache {
  readonly maxEntries: number;
  readonly ttlSeconds: number;
  get(credentialDigest: string): Promise<CachedResolution | undefined>;
  put(credentialDigest: string, resolution: CachedResolution): Promise<void>;
  invalidate(credentialDigest: string): Promise<void>;
}

export interface PusherResolverOptions {
  cache: ResolutionCache;
  /**
   * When true only identities and keys attested by an account link may
   * resolve a pusher; provider-token and key-listing resolutions are treated
   * as unconfirmed. Requires account linking to be configured.
   */
  strict: boolean;
}

export declare function createPusherResolver(options: PusherResolverOptions): PusherResolver;
