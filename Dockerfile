FROM node:16

WORKDIR /usr/src/docker/simple-container-schedules

COPY package*.json ./

RUN npm install --production

ENV NODE_ENV production

COPY . .

CMD ["npm","start"]