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
 * API authorization. Every route is listed in one matrix with its verb and
 * requirement; the app applies the matrix, and a matrix test asserts it.
 * Default deny: a mutating verb with no matrix entry is refused, and a read
 * with no entry requires an authenticated session.
 */

import { RequestHandler } from 'express';
import { Capability, RepositoryIdentity, UserRole } from '../domain';

export type Verb = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type Requirement =
  | { kind: 'public' }
  | { kind: 'authenticated' }
  | { kind: 'role'; role: UserRole }
  | { kind: 'capability'; capability: Capability }
  /** Satisfied by the record's pusher, a holder of the named capability, or an admin. */
  | { kind: 'owner-or-capability'; capability: Capability };

export interface MatrixEntry {
  pattern: string;
  verb: Verb;
  requirement: Requirement;
}

/** Reviewable in one place. Patterns are relative to /api/v1. */
export const AUTHORIZATION_MATRIX: readonly MatrixEntry[] = [
  { pattern: '/auth/login', verb: 'POST', requirement: { kind: 'public' } },
  { pattern: '/auth/logout', verb: 'POST', requirement: { kind: 'authenticated' } },
  { pattern: '/auth/me', verb: 'GET', requirement: { kind: 'authenticated' } },
  { pattern: '/auth/password', verb: 'POST', requirement: { kind: 'authenticated' } },

  { pattern: '/pushes', verb: 'GET', requirement: { kind: 'authenticated' } },
  { pattern: '/pushes/:id', verb: 'GET', requirement: { kind: 'authenticated' } },
  { pattern: '/pushes/:id/audit', verb: 'GET', requirement: { kind: 'authenticated' } },
  { pattern: '/pushes/:id/diff', verb: 'GET', requirement: { kind: 'authenticated' } },
  { pattern: '/pushes/counts', verb: 'GET', requirement: { kind: 'authenticated' } },
  {
    pattern: '/pushes/:id/approve',
    verb: 'POST',
    requirement: { kind: 'capability', capability: 'review' },
  },
  {
    pattern: '/pushes/:id/reject',
    verb: 'POST',
    requirement: { kind: 'capability', capability: 'review' },
  },
  {
    pattern: '/pushes/:id/cancel',
    verb: 'POST',
    requirement: { kind: 'owner-or-capability', capability: 'cancel' },
  },

  { pattern: '/repositories', verb: 'GET', requirement: { kind: 'authenticated' } },
  { pattern: '/repositories/:id', verb: 'GET', requirement: { kind: 'authenticated' } },
  { pattern: '/repositories/:id/grants', verb: 'GET', requirement: { kind: 'authenticated' } },
  { pattern: '/repositories', verb: 'POST', requirement: { kind: 'role', role: 'admin' } },
  { pattern: '/repositories/:id', verb: 'DELETE', requirement: { kind: 'role', role: 'admin' } },

  { pattern: '/users/me', verb: 'GET', requirement: { kind: 'authenticated' } },
  { pattern: '/users/me/emails', verb: 'POST', requirement: { kind: 'authenticated' } },
  { pattern: '/users/me/emails/:address', verb: 'DELETE', requirement: { kind: 'authenticated' } },
  { pattern: '/users/me/identities', verb: 'POST', requirement: { kind: 'authenticated' } },
  {
    pattern: '/users/me/identities/:providerId/:login',
    verb: 'DELETE',
    requirement: { kind: 'authenticated' },
  },
  { pattern: '/users/me/links/:providerId', verb: 'GET', requirement: { kind: 'authenticated' } },
  {
    pattern: '/users/me/links/:providerId/callback',
    verb: 'GET',
    requirement: { kind: 'authenticated' },
  },
  { pattern: '/users/me/grants', verb: 'GET', requirement: { kind: 'authenticated' } },
  { pattern: '/users/me/ssh-keys', verb: 'POST', requirement: { kind: 'authenticated' } },
  {
    pattern: '/users/me/ssh-keys/:fingerprint',
    verb: 'DELETE',
    requirement: { kind: 'authenticated' },
  },
  { pattern: '/users', verb: 'GET', requirement: { kind: 'role', role: 'admin' } },
  { pattern: '/users/:id', verb: 'GET', requirement: { kind: 'role', role: 'admin' } },
  { pattern: '/users', verb: 'POST', requirement: { kind: 'role', role: 'admin' } },
  { pattern: '/users/:id', verb: 'PATCH', requirement: { kind: 'role', role: 'admin' } },
  { pattern: '/users/:id/roles', verb: 'PUT', requirement: { kind: 'role', role: 'admin' } },
  { pattern: '/users/:id', verb: 'DELETE', requirement: { kind: 'role', role: 'admin' } },
  { pattern: '/users/:id/grants', verb: 'GET', requirement: { kind: 'role', role: 'admin' } },
  { pattern: '/users/:id/emails', verb: 'POST', requirement: { kind: 'role', role: 'admin' } },
  { pattern: '/users/:id/identities', verb: 'POST', requirement: { kind: 'role', role: 'admin' } },

  { pattern: '/groups', verb: 'GET', requirement: { kind: 'role', role: 'admin' } },
  { pattern: '/groups', verb: 'POST', requirement: { kind: 'role', role: 'admin' } },
  { pattern: '/groups/:id', verb: 'PUT', requirement: { kind: 'role', role: 'admin' } },
  { pattern: '/groups/:id', verb: 'DELETE', requirement: { kind: 'role', role: 'admin' } },
  { pattern: '/groups/:id/members', verb: 'POST', requirement: { kind: 'role', role: 'admin' } },
  {
    pattern: '/groups/:id/members/:userId',
    verb: 'DELETE',
    requirement: { kind: 'role', role: 'admin' },
  },
  { pattern: '/groups/:id/grants', verb: 'GET', requirement: { kind: 'role', role: 'admin' } },

  { pattern: '/grants', verb: 'GET', requirement: { kind: 'role', role: 'admin' } },
  { pattern: '/grants', verb: 'POST', requirement: { kind: 'role', role: 'admin' } },
  { pattern: '/grants/:id', verb: 'DELETE', requirement: { kind: 'role', role: 'admin' } },
  { pattern: '/grants/test', verb: 'POST', requirement: { kind: 'role', role: 'admin' } },

  { pattern: '/access-rules', verb: 'GET', requirement: { kind: 'role', role: 'admin' } },
  { pattern: '/access-rules', verb: 'POST', requirement: { kind: 'role', role: 'admin' } },
  { pattern: '/access-rules/:id', verb: 'PUT', requirement: { kind: 'role', role: 'admin' } },
  { pattern: '/access-rules/:id', verb: 'DELETE', requirement: { kind: 'role', role: 'admin' } },
  { pattern: '/access-rules/order', verb: 'PUT', requirement: { kind: 'role', role: 'admin' } },
  { pattern: '/access-rules/test', verb: 'POST', requirement: { kind: 'role', role: 'admin' } },

  { pattern: '/providers', verb: 'GET', requirement: { kind: 'authenticated' } },

  { pattern: '/config', verb: 'GET', requirement: { kind: 'role', role: 'admin' } },
  { pattern: '/config/reload', verb: 'POST', requirement: { kind: 'role', role: 'admin' } },
  { pattern: '/setup', verb: 'GET', requirement: { kind: 'public' } },

  { pattern: '/audit', verb: 'GET', requirement: { kind: 'role', role: 'admin' } },
  { pattern: '/audit/fetches', verb: 'GET', requirement: { kind: 'role', role: 'admin' } },
];

export declare function requireAuthenticated(): RequestHandler;
export declare function requireRole(role: UserRole): RequestHandler;

/** Extracts the repository a request concerns, so a capability can be evaluated against it. */
export type RepositoryFromRequest = (
  req: Parameters<RequestHandler>[0],
) => Promise<RepositoryIdentity>;

export declare function requireCapability(
  capability: Capability,
  repositoryFromRequest: RepositoryFromRequest,
): RequestHandler;

/** Applies the matrix: unmatched mutating verbs are refused, unmatched reads require a session. */
export declare function applyMatrix(matrix: readonly MatrixEntry[]): RequestHandler;

/** Projection of a user safe for non-admin viewers: no email addresses, no key material. */
export interface PublicUserView {
  id: string;
  username: string;
  displayName?: string;
}
