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
 * Canonical repository identity.
 *
 * Every scoped decision (grants, approvals, mirror cache keys, audit) is made
 * against this tuple, never against a raw request URL. Derivation from a URL
 * is deterministic and documented per provider kind: for nested namespaces
 * the name is the last path segment and the owner is everything before it.
 */

export interface RepositoryIdentity {
  providerId: string;
  /** Host as configured on the provider, lower-cased. */
  host: string;
  /** Namespace path, possibly multi-segment, without leading or trailing slash. */
  owner: string;
  /** Repository name without the .git suffix. */
  name: string;
}

/** `owner/name`, the form used for grant targets and display. */
export type RepositorySlug = string;

export declare function toSlug(repo: RepositoryIdentity): RepositorySlug;

/** Derives the canonical identity from a request path relative to a provider. Throws on an unparseable path. */
export declare function deriveRepositoryIdentity(
  providerId: string,
  host: string,
  requestPath: string,
): RepositoryIdentity;

/**
 * A repository registered with the proxy. Registration is what makes a push
 * evaluable; unregistered repositories are refused before any parsing.
 */
export interface RegisteredRepository {
  id: string;
  identity: RepositoryIdentity;
  /** Raw upstream URL as configured; retained for display and forwarding. */
  upstreamUrl: string;
  createdAt: string;
  updatedAt: string;
}
