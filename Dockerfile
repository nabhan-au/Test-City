FROM node:19
WORKDIR /usr/src/app
COPY visualizer /usr/src/app/visualizer
COPY bower.json /usr/src/app/
COPY .bowerrc /usr/src/app/
COPY package-lock.json /usr/src/app/
COPY package.json /usr/src/app/


RUN npm install -g bower
RUN bower install
RUN npm install

WORKDIR /usr/src/app/visualizer

ENTRYPOINT ["npm", "run", "dev", "--", "--host", "0.0.0.0"]