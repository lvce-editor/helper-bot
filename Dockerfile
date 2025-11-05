FROM node:24.11.0
WORKDIR /usr/src/app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV="production"
CMD [ "npm", "start" ]
