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

import bcrypt from 'bcryptjs';
import { IVerifyOptions, Strategy as LocalStrategy } from 'passport-local';
import type { PassportStatic } from 'passport';
import type { User } from '../../domain';
import { getStores, getUserStore } from '../../store';
import type { DefaultLocalUser } from './types';
export const type = 'local';

const DEFAULT_LOCAL_USERS: DefaultLocalUser[] = [
  {
    username: 'admin',
    password: 'admin',
    email: 'admin@place.com',
    gitAccount: 'none',
    admin: true,
  },
  {
    username: 'user',
    password: 'user',
    email: 'user@place.com',
    gitAccount: 'none',
    admin: false,
  },
];

const isProduction = (): boolean => process.env.NODE_ENV === 'production';
const isKnownDefaultCredentialAttempt = (username: string, password: string): boolean =>
  DEFAULT_LOCAL_USERS.some(
    (defaultUser) =>
      defaultUser.username.toLowerCase() === username.toLowerCase() &&
      defaultUser.password === password,
  );

// The password hash lives in the local credential store, not on the user:
// the v3 user record carries no secret material.

export const configure = async (passport: PassportStatic): Promise<PassportStatic> => {
  passport.use(
    new LocalStrategy(
      async (
        username: string,
        password: string,
        done: (err: unknown, user?: Partial<User>, info?: IVerifyOptions) => void,
      ) => {
        try {
          const user = await getUserStore().byUsername(username);
          if (!user) {
            return done(null, undefined, { message: 'Incorrect username.' });
          }

          const credential = await getStores().localCredentials.byUserId(user.id);
          const passwordCorrect = await bcrypt.compare(password, credential?.passwordHash ?? '');
          if (!passwordCorrect) {
            return done(null, undefined, { message: 'Incorrect password.' });
          }

          // Force password reset when using default accounts in production
          if (
            isProduction() &&
            isKnownDefaultCredentialAttempt(username, password) &&
            credential &&
            !credential.mustChangePassword
          ) {
            await getStores().localCredentials.set({ ...credential, mustChangePassword: true });
          }

          return done(null, user);
        } catch (error: unknown) {
          return done(error);
        }
      },
    ),
  );

  passport.serializeUser((user: Partial<User>, done) => {
    done(null, user.username);
  });

  passport.deserializeUser(async (username: string, done) => {
    try {
      const user = await getUserStore().byUsername(username);
      done(null, user);
    } catch (error: unknown) {
      done(error, null);
    }
  });

  return passport;
};

/**
 * Create the default admin and regular test users.
 */
export const createDefaultAdmin = async () => {
  const createIfNotExists = async (
    username: string,
    password: string,
    email: string,
    type: string,
    isAdmin: boolean,
  ) => {
    // 2.x mapping: the single `email` becomes one self-declared primary email,
    // `gitAccount` has no v3 counterpart (identities come from resolution or
    // linking), and the `admin` boolean becomes a role.
    const existing = await getUserStore().byUsername(username);
    if (!existing) {
      const user = await getUserStore().create({
        username,
        roles: isAdmin ? ['user', 'admin'] : ['user'],
        emails: [{ address: email, verified: false, source: 'self-declared', primary: true }],
        scmIdentities: [],
        sshKeys: [],
      });
      void type;
      await getStores().localCredentials.set({
        userId: user.id,
        passwordHash: await bcrypt.hash(password, 10),
        mustChangePassword: isProduction(),
      });
    }
  };

  for (const u of DEFAULT_LOCAL_USERS) {
    await createIfNotExists(u.username, u.password, u.email, u.gitAccount, u.admin);
  }
};
