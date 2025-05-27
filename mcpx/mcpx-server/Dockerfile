# Add specific sha
FROM node:20.18.1-alpine3.20@sha256:b5b9467fe7b33aad47f1ec3f6e0646a658f85f05c18d4243024212a91f3b7554

WORKDIR /
COPY ./package.json ./package.json
COPY ./package-lock.json ./package-lock.json
RUN npm install

COPY ./src ./src
COPY ./tsconfig.json ./tsconfig.json
COPY ./lunar-interceptor.ts ./lunar-interceptor.ts
RUN npm run build

COPY ./dist ./dist

EXPOSE 9000
CMD ["npm", "run", "serve"]
