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
 * User routes. A user's own profile exposes emails, upstream identities and
 * keys with provenance; a key the user adds is `self-declared` until a
 * provider listing or an account link attests it. Role changes are audited.
 */

import { Router } from 'express';
import { AppDependencies } from '../deps';
import { UserRole } from '../../domain';

export interface AddSshKeyRequest {
  publicKey: string;
  name?: string;
}

export interface CreateUserRequest {
  username: string;
  displayName?: string;
  roles: UserRole[];
  emails?: string[];
}

export interface SetRolesRequest {
  roles: UserRole[];
}

/**
 * GET    /me
 * POST   /me/ssh-keys                         self-declared until a provider or a link attests it
 * DELETE /me/ssh-keys/:fingerprint
 * POST   /me/emails                           self-declared
 * DELETE /me/emails/:address
 * POST   /me/identities                       self-declared provider login
 * DELETE /me/identities/:providerId/:login
 * GET    /me/links/:providerId                start an account-linking flow
 * GET    /me/links/:providerId/callback       completes it; the identity becomes verified
 * GET    /me/grants                           effective grants, direct and via groups
 * GET    /              admin; email addresses included only for admins
 * GET    /:id           admin
 * POST   /              admin; config-sourced users are refused
 * PATCH  /:id           admin
 * PUT    /:id/roles     admin; appends an AdminAuditEvent
 * DELETE /:id           admin
 * GET    /:id/grants    admin
 * POST   /:id/emails    admin; source recorded as admin
 * POST   /:id/identities admin; source recorded as admin
 */
export declare function createUserRoutes(deps: AppDependencies): Router;
