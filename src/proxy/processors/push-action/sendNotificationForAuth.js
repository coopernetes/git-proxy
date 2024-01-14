const Step = require('../../actions').Step;
const emailSender = (toAddress, subject, body) => {
};
const db = require('../../../db');

const exec = async (req, action) => {
  const step = new Step('notificationForAuth');
  step.setAsyncBlock(
    `Successfully pushed to Git Proxy: ${req.protocol}://${req.hostname}/admin/push/${action.id}`,
  );

  // Get AuthUser for Repo.
  const repoName = action.repo.split('/')[1].replace('.git', '');
  const repo = await db.getRepo(repoName);

  if (repo != null) {
    const authUsers = repo.users.canAuthorise;
    if (authUsers.length > 0) {
      let toAddress = '';
      for (const user of authUsers) {
        const userVal = await db.findUser(user);
        console.log(`Auth User: ${userVal.username} Email: ${userVal.email}`);
        toAddress = userVal.email + ',';
      }
      console.log(`Auth Email: ${toAddress}`);
      let emailBody =
        `<p>Push Request is awaiting authorisation.</p> <p>Tracking Id: ` + `${action.id}</p>`;

      emailBody =
        emailBody +
        `<p>Link: <a href="${req.hostname}/requests/${action.id}">` +
        `${req.hostname}/requests/${action.id}</a></p>`;

      emailBody += `<p>Please approve.</p><p>Thank you,</p><p>Git Proxy Team.</p>`;
      emailSender(toAddress, 'GITProxy:Push Request Approval', emailBody);
    } else {
      console.log(`NO Auth User assign to Repo`);
    }
  } else {
    console.log(`Repo not found`);
  }

  action.addStep(step);
  return action;
};

exec.displayName = 'sendNotificationForAuth.exec';
exports.exec = exec;
