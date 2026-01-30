# === Development stage (default) ===
FROM golang:1.25-bookworm AS dev

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    && rm -rf /var/lib/apt/lists/*

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN go install github.com/cosmtrek/air@v1.49.0

EXPOSE 8080

CMD ["air"]

# === Production stage ===
FROM golang:1.25-bookworm AS builder

WORKDIR /build

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-w -s" -o server .

FROM debian:bookworm-slim AS prod

RUN groupadd -r appuser && useradd -r -g appuser appuser
COPY --from=builder /build/server /usr/local/bin/server

USER appuser
EXPOSE 8080

ENTRYPOINT ["server"]
