FROM node:12-alpine

RUN apk add --no-cache git

WORKDIR /git/

COPY package*.json ./

RUN npm install

COPY . .

CMD npm run start:api
