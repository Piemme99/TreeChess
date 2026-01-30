# === Development stage (default) ===
FROM node:20-slim AS dev

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

# === Production stage ===
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-slim AS prod

RUN npm install -g serve && \
    groupadd -r appuser && useradd -r -g appuser appuser

COPY --from=builder /app/dist /app/dist

USER appuser
EXPOSE 3000

CMD ["serve", "-s", "/app/dist", "-l", "3000"]
