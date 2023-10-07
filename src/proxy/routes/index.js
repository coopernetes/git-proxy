/* eslint-disable max-len */
const express = require('express');
const proxy = require('express-http-proxy');
// eslint-disable-next-line new-cap
const router = express.Router();
const chain = require('../chain');

router.use(
  '/',
  proxy('https://github.com', {
    proxyReqOptDecorator: function (reqOpt) {
      if (
        reqOpt.path.includes('api/v3') ||
        reqOpt.path.includes('api/graphql')
      ) {
        reqOpt.host = 'api.github.com';
      }
      return new Promise((resolve) => {
        resolve(reqOpt);
      });
    },
    proxyReqPathResolver: function (req) {
      if (req.url.includes('api/v3')) {
        return req.url.replace('api/v3/', '');
      }
      if (req.url.includes('api/graphql')) {
        return req.url.replace('api/graphql', 'graphql');
      }
      return new Promise((resolve) => {
        resolve(req.url);
      });
    },
    filter: async function (req, res) {
      try {
        console.log(`received ${req.url}`);
        console.log('host is', req.headers.host);
        if (req.body && req.body.length) {
          req.rawBody = req.body.toString('utf8');
        }

        const action = await chain.exec(req, res);
        console.log('action processed');

        if (action.error || action.blocked) {
          if (action.type === 'push') {
            res.set('content-type', 'application/x-git-receive-pack-result');
            res.set('transfer-encoding', 'chunked');
            res.set('expires', 'Fri, 01 Jan 1980 00:00:00 GMT');
            res.set('pragma', 'no-cache');
            res.set('cache-control', 'no-cache, max-age=0, must-revalidate');
            res.set('vary', 'Accept-Encoding');
            res.set('x-frame-options', 'DENY');
            res.set('connection', 'close');

            let message;

            if (action.error) {
              message = action.errorMessage;
              console.error(message);
            }
            if (action.blocked) {
              message = action.blockedMessage;
            }

            // ERROR PCT LINE -- MOVE THIS TO HELPER
            const errorMessage = `ERR\t${message}`;
            const len = 6 + errorMessage.length;

            const prefix = len.toString(16);
            const packetMessage = `00${prefix}\x02${errorMessage}\n0000`;

            res.status(200).send(packetMessage);

            return false;
          }
          if (action.type === 'graphql') {
            const message = JSON.stringify({
              errors: [
                {
                  message: action.errorMessage,
                },
              ],
              type: 'UNKNOWN',
            });
            res.status(200).send(message);
            return false;
          }
          res.status(500).send('Something went horribly wrong');
          return false;
        }

        return true;
      } catch (e) {
        console.error(e);
        return false;
      }
    },
    userResDecorator: function (proxyRes, proxyResData) {
      // const data = proxyResData;
      // const ts = Date.now();
      // fs.writeFileSync(`./.logs/responses/${ts}.${proxyRes.statusCode}.status`, proxyRes.statusCode);
      // fs.writeFileSync(`./.logs/responses/${ts}.headers.json`, JSON.stringify(proxyRes.headers));
      // fs.writeFileSync(`./.logs/responses/${ts}.raw`, data);
      // fs.writeFileSync(`./.logs/responses/${ts}.txt`, data.toString('utf-8'));
      return proxyResData;
    },
  }),
);

module.exports = router;
