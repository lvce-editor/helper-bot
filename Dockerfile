FROM node:22.14.0
WORKDIR /usr/src/app
COPY package.json package-lock.json ./
COPY . .
RUN npm ci
RUN npm run build
ENV NODE_ENV="production"
CMD [ "npm", "start" ]
