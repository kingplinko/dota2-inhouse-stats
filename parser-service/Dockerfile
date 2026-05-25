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

# Install Manta (Dota 2 parser)
RUN go install github.com/dotabuff/manta/cmd/manta@latest

# Copy package files and install Node dependencies
COPY package.json ./
RUN npm install --production

# Copy application code
COPY server.js ./
COPY parseReplay.js ./

# Expose port
EXPOSE 5000

# Start the service
CMD ["node", "server.js"]
