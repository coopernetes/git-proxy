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
 * Group routes, admin only. Every mutation appends an AdminAuditEvent naming
 * actor, action, target and outcome.
 */

import { Router } from 'express';
import { AppDependencies } from '../deps';

export interface UpsertGroupRequest {
  name: string;
  memberIds: string[];
  idpGroup?: string;
}

/**
 * GET    /
 * POST   /
 * PUT    /:id
 * DELETE /:id
 * POST   /:id/members          add a user
 * DELETE /:id/members/:userId
 * GET    /:id/grants           grants held through this group
 */
export declare function createGroupRoutes(deps: AppDependencies): Router;
