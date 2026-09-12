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
 * Grant routes, admin only. Grants are the only source of push, review and
 * fetch permission; the test endpoint answers the same evaluator the engine
 * uses, so an administrator sees the live decision.
 */

import { Router } from 'express';
import { AppDependencies } from '../deps';
import { AuthorizationQuery, GrantName, Target } from '../../domain';

export interface CreateGrantRequest {
  grant: GrantName;
  target: Target;
  providerId?: string;
  userId?: string;
  groupId?: string;
}

export type GrantTestRequest = AuthorizationQuery;

/**
 * GET    /
 * POST   /
 * DELETE /:id
 * POST   /test   evaluates an AuthorizationQuery; returns the decision and matched grant
 */
export declare function createGrantRoutes(deps: AppDependencies): Router;
