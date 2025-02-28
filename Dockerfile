FROM node:22.13.0
WORKDIR /usr/src/app
COPY package.json package-lock.json ./
RUN npm ci
RUN npm run build
ENV NODE_ENV="production"
COPY . .
CMD [ "npm", "start" ]
