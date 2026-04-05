FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src/ ./src/

RUN mkdir -p statements processed actual-data

ENV ACTUAL_DATA_DIR=/app/actual-data

CMD ["node", "src/poller.js"]
