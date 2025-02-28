FROM node:22.13.0
WORKDIR /usr/src/app
COPY package.json package-lock.json ./
RUN npm ci --production
RUN npm cache clean --force
COPY . .
RUN npm run build
ENV NODE_ENV="production"
CMD [ "npm", "start" ]
