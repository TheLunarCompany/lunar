FROM node:22.16-alpine3.21

WORKDIR /
RUN apk add --no-cache python3=3.12.10-r1 uv=0.5.31-r0

COPY ./package.json ./package.json
COPY ./package-lock.json ./package-lock.json
RUN npm install

COPY ./src ./src
COPY ./tsconfig.json ./tsconfig.json
COPY ./lunar-interceptor.ts ./lunar-interceptor.ts
RUN npm run build

EXPOSE 9000
CMD ["npm", "run", "serve"]
