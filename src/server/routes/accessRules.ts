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
 * Access rule routes, admin only. Rules are ordered; first match wins, so
 * ordering is a first-class operation rather than an edit of each rule.
 */

import { Router } from 'express';
import { AppDependencies } from '../deps';
import { AccessRule } from '../../domain';

export type UpsertAccessRuleRequest = Omit<AccessRule, 'id' | 'order'>;

export interface ReorderRequest {
  orderedIds: string[];
}

/**
 * GET    /
 * POST   /
 * PUT    /:id
 * DELETE /:id
 * POST   /test   evaluates a repository path and service against the ordered rules; returns the matched rule
 * PUT    /order
 */
export declare function createAccessRuleRoutes(deps: AppDependencies): Router;
