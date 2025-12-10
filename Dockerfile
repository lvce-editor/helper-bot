FROM node:24.12.0
WORKDIR /usr/src/app

COPY . .

RUN npm ci --ignore-scripts
RUN npm run postinstall

RUN npm run build
RUN rm -rf node_modules

ENV NODE_ENV="production"
CMD [ "npm", "start" ]
