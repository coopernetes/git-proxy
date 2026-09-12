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
 * Client-facing messaging during a push. Progress and deferral notices go on
 * band 2 with periodic heartbeats so a held connection is never mistaken for
 * a hang; the outcome goes as report-status. The reason a client sees is the
 * same string recorded on the push record.
 */

import { PktLineWriter } from '../git';

export interface ProgressWriter {
  readonly heartbeatIntervalMs: number;
  line(message: string): void;
  /** States the correlation id and, when a dashboard is configured, the review URL. */
  deferral(notice: { pushId: string; reviewUrl?: string }): void;
  /** Starts heartbeats; stops on close. */
  hold(): void;
  close(): void;
}

export interface ReportStatusWriter {
  unpackOk(): void;
  unpackFailed(reason: string): void;
  ok(ref: string): void;
  ng(ref: string, reason: string): void;
  end(): void;
}

export declare function createProgressWriter(
  writer: PktLineWriter,
  options: { quiet: boolean; heartbeatIntervalMs: number },
): ProgressWriter;

export declare function createReportStatusWriter(
  writer: PktLineWriter,
  options: { sideband: boolean },
): ReportStatusWriter;
