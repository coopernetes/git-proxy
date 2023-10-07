#!/usr/bin/env bash
set -xe

sudo docker run -it -v "$PWD"/nginx.conf:/etc/nginx/nginx.conf \
  -v "$PWD"/ssl:/etc/nginx/ssl \
  --add-host=host.docker.internal:host-gateway \
  -p 443:443 nginx
