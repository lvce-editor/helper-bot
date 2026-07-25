FROM node:24.15.0 AS builder
WORKDIR /usr/src/app

COPY package.json package-lock.json ./
COPY packages/app/package.json ./packages/app/
COPY packages/build/package.json ./packages/build/
COPY packages/exec-worker/package.json ./packages/exec-worker/
COPY packages/github-worker/package.json ./packages/github-worker/
COPY packages/migrations/package.json ./packages/migrations/

RUN npm ci --ignore-scripts

COPY . .

RUN npm run build

FROM node:24.15.0-slim
WORKDIR /usr/src/app

COPY package.json package-lock.json ./
COPY packages/app/package.json packages/app/app.yml packages/app/dependencies.json ./packages/app/
COPY packages/build/package.json ./packages/build/
COPY packages/exec-worker/package.json ./packages/exec-worker/
COPY packages/github-worker/package.json ./packages/github-worker/
COPY packages/migrations/package.json ./packages/migrations/

RUN npm ci --omit=dev --ignore-scripts --workspace=@lvce-editor/helper-bot --workspace=@lvce-editor/helper-bot-github-worker

COPY --from=builder /usr/src/app/packages/app/dist ./packages/app/dist
COPY --from=builder /usr/src/app/packages/github-worker/dist ./packages/github-worker/dist

ENV NODE_ENV="production"
CMD ["npm", "start", "--workspace=@lvce-editor/helper-bot"]
