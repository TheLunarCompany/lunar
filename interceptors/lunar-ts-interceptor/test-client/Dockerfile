FROM alpine:latest

ARG AXIOS_VERSION=*
ARG CLIENT_TYPE "axios"
ENV CLIENT=$CLIENT_TYPE
RUN echo ${AXIOS_VERSION}

RUN apk update
RUN apk add --update nodejs npm

WORKDIR /lunar

COPY ["../..", "./lunar-ts-interceptor"]

WORKDIR /lunar/lunar-ts-interceptor
RUN npm install
RUN npx tsc

WORKDIR /lunar/lunar-ts-interceptor/test-client
RUN npm install

ENTRYPOINT ["sh", "-c", "node ${CLIENT}_client.js"]
