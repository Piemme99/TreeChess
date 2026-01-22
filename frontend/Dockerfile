FROM node:20-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libc6 \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN rm -rf node_modules package-lock.json && npm install

COPY . .
EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
