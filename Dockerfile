FROM node:24.11.1
WORKDIR /usr/src/app
COPY . .
RUN npm ci
RUN npm run build
ENV NODE_ENV="production"
CMD [ "npm", "start" ]
