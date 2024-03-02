import express, { Router as router } from 'express';
import proxy from 'express-http-proxy';
/**
 * Represents a proxying HTTP server.
 */
export class ProxyServer {
  private app: express.Application;
  private router: express.Router;
  private readonly upstreamUrl: string;
  private readonly rootPath: string;
  private readonly port: number = 3000;

  /**
   * Create a new instance of the proxy server for a given upstream URL.
   * Multiple instances of the server can be created to proxy different URLs.
   * @param {string} upstreamUrl The URL to proxy requests to.
   * @param {string} rootPath The root path for the server.
   * @param {number | undefined} port The HTTP or HTTPS port to listen on.
   */
  constructor(upstreamUrl: string, rootPath: string, port: number | undefined) {
    this.app = express();
    this.router = router();
    this.upstreamUrl = upstreamUrl;
    this.rootPath = rootPath;
    if (port) {
      this.port = port;
    }
  }

  /**
   * Configures the server.
   */
  public configure(): void {
    this.router.use(
      '/',
      proxy(this.upstreamUrl, {
        filter: async (req, _res) => {
          console.log(req.url);
          return true;
        },
      }),
    );
  }

  /**
   * Starts the server.
   */
  public start() {
    this.app.use(this.rootPath, this.router);
    this.app.listen(this.port, () => {
      console.log(`Server is running on port ${this.port}`);
    });
  }
}
