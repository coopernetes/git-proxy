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

/** Error helpers shared by the server and the dashboard. Kept concrete because the dashboard calls them at runtime. */

export const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};

export const handleErrorAndLog = (error: unknown, messagePrefix?: string): string => {
  const msg = `${messagePrefix ? `${messagePrefix}: ` : ''}${getErrorMessage(error)}`;
  console.error(msg);
  return msg;
};

export const handleErrorAndThrow = (error: unknown, message?: string): never => {
  const msg = getErrorMessage(error);
  console.error(message);
  throw new Error(`${message ? `${message}: ` : ''}${msg}`);
};
