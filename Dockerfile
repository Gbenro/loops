FROM node:20-alpine AS builder

WORKDIR /app

# Accept build argument for API URL
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Debug: print the API URL during build
RUN echo "Building with VITE_API_URL: $VITE_API_URL"

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config template
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Railway sets PORT env var - nginx uses envsubst to replace ${PORT}
ENV PORT=8080

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
