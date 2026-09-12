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
 * Bounded waiting. A submission may not stay pending indefinitely and an
 * approval may not stay unconsumed indefinitely. Both expiries transition
 * the record with an automated attestation naming the mechanism. The sweep
 * is triggered opportunistically when a new submission for the same
 * repository arrives, and optionally on a period.
 */

import { ReviewWindowPolicy } from '../../domain';

export interface ExpirySweep {
  readonly policy: ReviewWindowPolicy;
  /** Cancels pending submissions and supersedes prior pending pushes on the same repository and ref. */
  onSubmission(repositorySlug: string, ref: string): Promise<void>;
  /** Periodic pass over every pending and approved-unconsumed record. */
  sweep(): Promise<{ canceledPending: number; canceledApprovals: number }>;
}

export interface ExpiryTrigger {
  /** Absent: opportunistic only. */
  periodSeconds?: number;
}
