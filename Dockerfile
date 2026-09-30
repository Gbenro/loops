FROM node:20-alpine

WORKDIR /app

# Copy package manifests
COPY package*.json ./
COPY mcp-server/package*.json ./mcp-server/

# Install dependencies
RUN npm install
RUN cd mcp-server && npm install

# Copy application code
COPY . .

# Build mcp-server TypeScript
RUN cd mcp-server && npm run build

# Expose port (Railway automatically injects $PORT)
EXPOSE 3001

# Launch server
CMD ["node", "mcp-server/dist/server.js"]
