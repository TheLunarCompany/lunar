FROM ubuntu:22.04

ARG CLIENT_TYPE "axios"
ARG NODEJS_VERSION "16.14.2"
ENV CLIENT=$CLIENT_TYPE
ENV NODE_VERION=$NODEJS_VERSION

RUN apt-get update && apt-get install wget curl python3 ca-certificates rsync -y \
    && rm -rf /var/lib/apt/lists/*

RUN wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.6/install.sh | bash

ENV NVM_DIR=/root/.nvm
RUN . "$NVM_DIR/nvm.sh" && nvm install $NODEJS_VERSION
RUN . "$NVM_DIR/nvm.sh" && nvm use v$NODEJS_VERSION
RUN . "$NVM_DIR/nvm.sh" && nvm alias default v$NODEJS_VERSION

RUN if [ ! -e /usr/bin/npm ]; then ln -s /root/.nvm/versions/node/v$NODEJS_VERSION/bin/npm /usr/bin/npm ; fi
RUN if [ ! -e /usr/bin/node ]; then ln -s /root/.nvm/versions/node/v$NODEJS_VERSION/bin/node /usr/bin/node ; fi

RUN npm install -g typescript

RUN if [ ! -e /usr/bin/npx ]; then ln -s /root/.nvm/versions/node/v$NODEJS_VERSION/bin/npx /usr/bin/npx ; fi

WORKDIR /lunar

COPY ["../..", "./lunar-ts-interceptor"]

WORKDIR /lunar/lunar-ts-interceptor
RUN npm install
RUN npx tsc

WORKDIR /lunar/lunar-ts-interceptor/test-client
RUN npm install

ENTRYPOINT ["sh", "-c", "node ${CLIENT}_client.js"]
