FROM node:24.13.1
WORKDIR /usr/src/app

# Copy package files first for better layer caching
COPY package.json package-lock.json lerna.json ./
COPY packages/app/package.json packages/app/package-lock.json ./packages/app/
COPY packages/build/package.json packages/build/package-lock.json ./packages/build/
COPY packages/exec-worker/package.json packages/exec-worker/package-lock.json ./packages/exec-worker/
COPY packages/github-worker/package.json packages/github-worker/package-lock.json ./packages/github-worker/
COPY packages/migrations/package.json packages/migrations/package-lock.json ./packages/migrations/

# Install dependencies (cached unless package files change)
RUN npm ci --ignore-scripts
RUN npm run postinstall

# Copy source files
COPY . .

RUN npm run build
RUN rm -rf node_modules

ENV NODE_ENV="production"
CMD [ "npm", "start" ]
