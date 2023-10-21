'use strict';

const { exec } = require('child_process');

console.log('Generating coverage report for changed files...');
const files = [];
exec('git diff --name-only HEAD~1', (err, stdout, stderr) => {
  if (err) {
    console.error(err + stderr);
    return;
  }
  files.push(...stdout.split('\n'));
});

module.exports = {
  include: files,
  branches: 80,
  lines: 80,
  functions: 80,
  statements: 80,
};
