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
 * Dashboard authentication routes. Delegates to the existing Passport
 * strategies (local, Active Directory, OpenID Connect) and the bearer-token
 * handler for API clients. The session identity these establish is the only
 * reviewer identity the push routes accept.
 */

import { Router } from 'express';
import { PassportStatic } from 'passport';
import { AppDependencies } from '../deps';

/** Wraps the existing `configure` from src/service/passport against the v3 user store. */
export declare function configurePassport(deps: AppDependencies): Promise<PassportStatic>;

/**
 * POST /login      local credentials, or redirect for OIDC
 * GET  /callback   OIDC return
 * POST /logout
 * GET  /me         session user, roles, and whether a password change is required
 * POST /password   local strategy only; enforces the must-change flag via passwordChangeHandler
 */
export declare function createAuthRoutes(deps: AppDependencies, passport: PassportStatic): Router;
