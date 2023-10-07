const config = require('@finos/git-proxy/src/config');
const GraphqlPlugin = require('@finos/git-proxy/src/plugin').GraphqlPlugin;
const Step = require('@finos/git-proxy/src/proxy/actions').Step;

const githubIssuePlugin = new GraphqlPlugin(async (req, action) => {
  const step = new Step('githubIssuePlugin');
  action.addStep(step);
  if (action.repo === 'NOT-FOUND' || action.project === 'NOT-FOUND') {
    console.warn('Received a request without a canonical repository, skipping');
    return action;
  }
  console.log(`req body: ${req.body.toString()}`);
  console.log(`req url: ${req.originalUrl}`);
  console.log(JSON.stringify(action));
  // copied largely from checkRepoInAuthorisedList
  // unlike the original, this plugin is only concerned with what is configured
  // and ignores the database (which mutates over time)
  const list = await config.getAuthorisedList();

  const found = list.find((x) => {
    // no need to replace .git since its not part of the url
    // GraphQL body contains:
    // "variables": {
    //   "owner": "finos",
    //   "repo": "git-proxy"
    // }
    const targetName = action.repo;
    const allowedName = `${x.project}/${x.name}`;
    console.log(`${targetName} = ${allowedName}`);
    return targetName === allowedName;
  });

  console.log(found);

  if (!found) {
    console.log('not found');
    step.error = true;
    step.log(`repo ${action.repo} is not in the authorisedList, ending`);
    console.log('setting error');
    step.setError(`Rejecting repo ${action.repo} not in the authorisedList`);
    action.addStep(step);
    return action;
  }

  console.log('found');
  step.log(`repo ${action.repo} is in the authorisedList`);
  action.addStep(step);
  return action;
});

module.exports.githubIssuePlugin = githubIssuePlugin;
