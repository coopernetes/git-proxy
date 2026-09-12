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
 * Annotated tag inspection. A tag object is inspected as an object of its
 * own: tagger identity, message and signature. Dereferencing to the target
 * commit alone would leave the tag a channel that carries uninspected text.
 */

import { Check } from '../contract';

export interface TagObjectsConfig {
  /** Require the tagger email to belong to the resolved pusher. Default false. */
  requireTaggerMatch: boolean;
  /** Refuse tags that point at anything other than a commit. Default true. */
  commitTargetsOnly: boolean;
}

export declare const tagObjects: Check;
