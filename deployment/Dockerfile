# Backend Dockerfile
FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements
COPY backend/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ .

# Frontend build stage
FROM node:18-alpine AS frontend-build

WORKDIR /app

# Copy frontend files
COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ .
RUN npm run build

# Final stage
FROM python:3.10-slim

WORKDIR /app

# Copy backend from first stage
COPY --from=0 /app .

# Copy frontend build
COPY --from=frontend-build /app/dist /app/frontend

# Install Uvicorn
RUN pip install uvicorn

# Expose port
EXPOSE 8000

# Run command
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]