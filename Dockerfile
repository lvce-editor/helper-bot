FROM node:24.13.0 AS builder
WORKDIR /usr/src/app

COPY package.json package-lock.json lerna.json ./
COPY packages/app/package.json packages/app/package-lock.json ./packages/app/
COPY packages/build/package.json packages/build/package-lock.json ./packages/build/
COPY packages/exec-worker/package.json packages/exec-worker/package-lock.json ./packages/exec-worker/
COPY packages/github-worker/package.json packages/github-worker/package-lock.json ./packages/github-worker/
COPY packages/migrations/package.json packages/migrations/package-lock.json ./packages/migrations/

RUN npm ci --ignore-scripts
RUN npm run postinstall

COPY . .

RUN npm run build

FROM node:24.13.0-slim
WORKDIR /usr/src/app

COPY packages/app/package.json packages/app/package-lock.json packages/app/app.yml packages/app/dependencies.json ./packages/app/
COPY packages/github-worker/package.json packages/github-worker/package-lock.json ./packages/github-worker/

RUN npm --prefix packages/app ci --omit=dev --ignore-scripts
RUN npm --prefix packages/github-worker ci --omit=dev --ignore-scripts

COPY --from=builder /usr/src/app/packages/app/dist ./packages/app/dist
COPY --from=builder /usr/src/app/packages/github-worker/dist ./packages/github-worker/dist

ENV NODE_ENV="production"
CMD ["npm", "--prefix", "packages/app", "start"]
