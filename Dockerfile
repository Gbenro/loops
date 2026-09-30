FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY mcp-server/package.json ./mcp-server/

RUN npm install
RUN cd mcp-server && npm install

COPY . .

RUN cd mcp-server && npm run build

ENV PORT=3001

CMD ["node", "mcp-server/dist/server.js"]
