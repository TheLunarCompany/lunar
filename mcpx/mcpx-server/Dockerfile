FROM node:20-alpine3.21

WORKDIR /
RUN apk add --no-cache python3 uv    # installs uv and uvx via the repo

COPY ./package.json ./package.json
COPY ./package-lock.json ./package-lock.json
RUN npm install

COPY ./src ./src
COPY ./tsconfig.json ./tsconfig.json
COPY ./lunar-interceptor.ts ./lunar-interceptor.ts
RUN npm run build

EXPOSE 9000
CMD ["npm", "run", "serve"]
