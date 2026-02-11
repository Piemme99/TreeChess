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

FROM nginxinc/nginx-unprivileged:1.27-alpine AS prod

RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx.prod.conf /etc/nginx/nginx.prod.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080 8443

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
