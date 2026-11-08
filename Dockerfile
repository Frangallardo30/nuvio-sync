FROM node:24-alpine
WORKDIR /app
COPY package.json server.mjs model.mjs nuvio.mjs ./
COPY public ./public
RUN mkdir /data && chown node:node /data
ENV HOST=0.0.0.0 PORT=3000 DATA_DIR=/data
USER node
VOLUME /data
EXPOSE 3000
CMD ["node", "server.mjs"]
