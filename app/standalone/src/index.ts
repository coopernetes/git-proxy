import { ProxyServer } from '@finos/git-proxy-server/src/http/server';
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
  const server = new ProxyServer('https://github.com', '/github', 8081);
  server.configure();
  server.start();
}
