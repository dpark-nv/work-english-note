FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4177
ENV DATA_DIR=/app/data

COPY package.json ./
COPY server.js ./
COPY public ./public

RUN mkdir -p /app/data

EXPOSE 4177

CMD ["node", "server.js"]
