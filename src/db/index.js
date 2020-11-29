const generator = require('generate-password');
const config = require('../config');

if (config.getDatabase().type === 'fs') {
  sink = require('../db/file');
}

if (config.getDatabase().type === 'mongo') {
  sink = require('../db/mongo');
}

module.exports.createUser = async (
    username, password, email,
    canPull=false, canPush=false, canAuthorise=false, admin=false) => {
  const data = {
    username: username,
    password: password,
    email: email,
    admin: admin,
    canPull: canPull,
    canPush: canPush,
    canAuthorise: canAuthorise,
    changePassword: true,
    token: generator.generate({length: 10, numbers: true}),
  };

  const existingUser = await sink.findUser(username);

  if (existingUser) {
    const errorMessage = `user ${username} already exists`;
    throw new Error(errorMessage);
  }

  sink.createUser(data);
};

// The module exports
module.exports.authorise = sink.authorise;
module.exports.reject = sink.reject;
module.exports.cancel = sink.cancel;
module.exports.getPushes = sink.getPushes;
module.exports.writeAudit = sink.writeAudit;
module.exports.getPush = sink.getPush;
module.exports.findUser = sink.findUser;
module.exports.deleteUser = sink.deleteUser;
module.exports.updateUser = sink.updateUser;
module.exports.getRepos = sink.getRepos;
module.exports.getRepo = sink.getRepo;
module.exports.createRepo = sink.createRepo;
module.exports.addUserCanPush = sink.addUserCanPush;
module.exports.addUserCanAuthorise = sink.addUserCanAuthorise;
module.exports.deleteRepo = sink.deleteRepo;
