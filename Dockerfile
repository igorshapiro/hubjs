FROM node:latest

RUN npm install -g bunyan nodemon

ADD . /app/code
WORKDIR /app/code
VOLUME /app/code

EXPOSE 8080

CMD nodemon -x 'npm start' | bunyan --color
