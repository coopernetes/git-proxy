# standalone
This is a separate executable package which only launches the bare minimum "proxying" functionality in Git Proxy as a standalone server application.

To deploy this, you could run something like this inside a Docker container:

```
npx @finos/git-proxy-standalone -- <args>
```
