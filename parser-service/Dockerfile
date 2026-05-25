FROM node:18-slim

WORKDIR /app

# Install Go and build dependencies
RUN apt-get update && apt-get install -y \
    wget \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Go
RUN wget https://go.dev/dl/go1.21.5.linux-amd64.tar.gz && \
    tar -C /usr/local -xzf go1.21.5.linux-amd64.tar.gz && \
    rm go1.21.5.linux-amd64.tar.gz

ENV PATH="/usr/local/go/bin:${PATH}"
ENV GOPATH="/go"
ENV PATH="${GOPATH}/bin:${PATH}"

# Copy and build Go parser
WORKDIR /app/go-parser
COPY dota-parser.go go.mod ./
RUN go mod download
RUN go build -o /usr/local/bin/dota-parser dota-parser.go

# Setup Node app
WORKDIR /app
COPY package.json ./
RUN npm install --production

# Copy application code
COPY server.js ./
COPY parseReplay.js ./

# Verify parser binary exists
RUN which dota-parser && dota-parser --help || echo "Parser installed"

# Expose port
EXPOSE 5000

# Start the service
CMD ["node", "server.js"]
