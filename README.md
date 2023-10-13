<br />
<div align="center">
  <a href="https://github.com/finos/git-proxy">
    <img src="./docs/img/logo.png" alt="Logo" height="95">
  </a>

  <br />
  <br />

  <p align="center">
    Deploy custom push protections and policies<br />on top of Git
    <br />
    <br />
    <a href="https://www.npmjs.com/package/@finos/git-proxy"><strong><code>npm install @finos/git-proxy</code></strong></a>
    <br />
    <br />
    <a href="https://github.com/finos/git-proxy/issues/new?assignees=&labels=&projects=&template=bug_report.md&title=">Report a bug</a>
    ·
    <a href="https://github.com/finos/git-proxy/issues/new?assignees=&labels=&projects=&template=feature_request.md&title=">Suggest a new feature</a>
  </p>

  <br />

[![FINOS - Released](https://cdn.jsdelivr.net/gh/finos/contrib-toolbox@master/images/badge-released.svg?colorA=000000)](https://finosfoundation.atlassian.net/wiki/display/FINOS/Released)
[![NPM](https://img.shields.io/npm/v/@finos/git-proxy?colorA=00C586&colorB=000000)](https://www.npmjs.com/package/@finos/git-proxy)
[![Build](https://img.shields.io/github/actions/workflow/status/finos/git-proxy/nodejs.yml?branch=main&label=CI&logo=github&colorA=00C586&colorB=000000)](https://github.com/finos/git-proxy/actions/workflows/nodejs.yml)
<br />
[![License](https://img.shields.io/github/license/finos/git-proxy?colorA=00C586&colorB=000000)](https://github.com/finos/git-proxy/blob/main/LICENSEP)
[![Contributors](https://img.shields.io/github/contributors/finos/git-proxy?colorA=00C586&colorB=000000)](https://github.com/finos/git-proxy/graphs/contributors)
[![Stars](https://img.shields.io/github/stars/finos/git-proxy?colorA=00C586&colorB=000000)](https://github.com/finos/git-proxy/stargazers)
[![Forks](https://img.shields.io/github/forks/finos/git-proxy?colorA=00C586&colorB=000000)](https://github.com/finos/git-proxy/forks)

</div>
<br />

## About Git Proxy

<img align="right" width="550" src="./docs/img/demo.png" alt="Git Proxy Demonstration" />


Git Proxy deploys custom push protections and policies on top of Git. It is a highly configurable framework allowing developers and organizations to enforce push protections relevant to their developer workflow, security posture and risk appetite.

Git Proxy is built with a developer-first mindset. By presenting simple-to-follow remediation instructions in the CLI/Terminal, it minimises the friction of use and adoption, and keeps developers focused on what matters; committing and pushing code.


## Installation

To install Git Proxy, you must have [Node.js 16 or later](https://nodejs.org/en/download) installed. Use [npm](https://www.npmjs.com) to install the package:

```bash
$ npm install -g @finos/git-proxy
```

To install a specific version of Git Proxy, append the version to the end of the `install` command:

```bash
$ npm install -g @finos/git-proxy@1.1.0
```

To start the server, run `git-proxy`. Alternatively, you can also install & run git-proxy directly using `npx`:

```bash
$ git-proxy
# Running with npx - if the package isn't already installed, npx will prompt you to confirm installation
$ npx --package=@finos/git-proxy@1.1.0 -- git-proxy
```

## Configuration
By default, git-proxy ships with a [default configuration](./proxy.config.json) for demonstration purposes. In most environments, this should be overridden by your user-specific values.

To set your own values, create a `proxy.config.json` in the current working directory. This will be loaded when you execute `git-proxy` if present.

If you wish to specify a different file location to use as configuration, use the `-c/--config` command-line argument:

```bash
$ git-proxy --config /etc/gitproxy/config.json
# With npx
$ npx -- @finos/git-proxy --config /etc/gitproxy/config.json
```

### Validation
To validate your configuration against the [included schema](config.schema.json), use the following included script:

```bash
$ git-proxy --validate
# Run validation against a configuration at a custom file location
$ git-proxy --validate --config /etc/gitproxy/config.json
```

## Contributing

Your contributions are at the core of making this a true open source project. Any contributions you make are **greatly appreciated**.

<br />

<a src="https://github.com/finos/git-proxy/fork">
<img align="right" width="300" src="https://firstcontributions.github.io/assets/Readme/fork.png" alt="fork this repository" />
</a>

#### Fork the repository

Click on the **fork** button at the top of the page. This will create a copy of this repository under your GitHub account.

<br />
<br />

#### Clone the repository

<img align="right" width="300" src="https://firstcontributions.github.io/assets/Readme/copy-to-clipboard.png" alt="copy URL to clipboard" />

**Clone** the repository to your machine. Go to the repository via your GitHub account and click on the **Code** button.

Run the following command in your CLI/Terminal:

```bash
$ git clone https://github.com/YOUR_GITHUB_USRERNAME/git-proxy.git
```

<br />
<br />

#### Branch, code, commit and push

<br />

##### Branch

You can start coding on the default branch on your fork of the project, commonly `master` or `main`. If you want to create a branch to clearly identify your work, run:

```bash
$ git checkout -b feature/name-of-the-feature-you-are-creating
```

<br />

##### Code

This part is up to you. Be creative and write some magical code! 🧙🪄

<br />

##### Commit

Once you have finished making all of your improvements and changes, run the following:

```bash
$ git commit -m "YOUR COMMIT MESSAGE"
```

<br />

##### Push

Now that you've created a commit with your changes, it's time to push to GitHub:

```bash
git push
```

<br />

##### Open a pull request

With your changes applied to your fork of the project, it's time to [open a pull request from your repository](https://github.com/finos/git-proxy/compare)...

<br />

## Security

If you identify a security vulnerability in the codebase, please follow the steps in [`SECURITY.md`](https://github.com/finos/git-proxy/security/policy). This includes logic-based vulnerabilities and sensitive information or secrets found in code.

## Code of Conduct

We are committed to making open source an enjoyable and respectful experience for our community. See <a href="https://github.com/finos/git-proxy/blob/main/CODE_OF_CONDUCT.md"><code>CODE_OF_CONDUCT</code></a> for more information.

## License

This project is distributed under the Apache-2.0 license. See <a href="./LICENSE"><code>LICENSE</code></a> for more information.

## Contact

If you have a query or require support with this project, [raise an issue](https://github.com/finos/git-proxy/issues). Otherwise, reach out to [help@finos.org](mailto:help@finos.org).

