FROM golang:1.21-alpine

WORKDIR /app

# Install git (required for go install)
RUN apk add --no-cache git

# Copy dependencies first (for better caching)
COPY go.mod go.sum ./
RUN go mod download

# Install air (hot reload for Go)
# Use a version compatible with Go 1.21
RUN go install github.com/cosmtrek/air@v1.49.0

EXPOSE 8080

# air is already in PATH at /go/bin/air
CMD ["air"]
