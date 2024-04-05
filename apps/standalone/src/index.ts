import { start } from '@finos/git-proxy-httpserver';
import yargs from 'yargs';

const argv = yargs(process.argv.slice(2))
  .options({
    http: {
      type: 'boolean',
      description: 'Start the git-proxy server',
      required: false,
    },
  })
  .parseSync();

if (argv.http) {
  start().then(
    () => {
      console.log('Server started');
    },
    (err: Error) => {
      console.error(err);
    },
  );
}
