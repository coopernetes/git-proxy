const actions = require('../../actions');

const exec = async (req) => {
  const id = Date.now();
  const timestamp = id;
  let repoName = getRepoNameFromUrl(req.originalUrl);
  const paths = req.originalUrl.split('/');

  let type = 'pull';
  if (
    paths[paths.length - 1] == 'git-receive-pack' &&
    req.method == 'POST' &&
    req.headers['content-type'] == 'application/x-git-receive-pack-request'
  ) {
    type = 'push';
  }

  if (paths.find((s) => s.includes('graphql')) !== undefined) {
    type = 'graphql';
    console.log(`body: ${req.body.toString()}`);
    const gqlBody = JSON.parse(req.body.toString());
    if (Object.keys(gqlBody).includes('variables')) {
      repoName = `${gqlBody.variables.owner}/${gqlBody.variables.repo}`;
    }
  }
  if (paths.find((s) => s.includes('v3')) !== undefined) {
    type = 'rest';
    console.log(`url: ${req.originalUrl}`);
  }
  return new actions.Action(id, type, req.method, timestamp, repoName);
};

const getRepoNameFromUrl = (url) => {
  const parts = url.split('/');

  for (let i = 0, len = parts.length; i < len; i++) {
    const part = parts[i];
    if (part.endsWith('.git')) {
      const repo = `${parts[i - 1]}/${part}`;
      return repo.trim();
    }
  }
  return 'NOT-FOUND';
};

exec.displayName = 'parseAction.exec';
exports.exec = exec;
