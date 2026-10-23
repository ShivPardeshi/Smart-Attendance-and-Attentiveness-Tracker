# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Python Backend Runtime
FROM python:3.11-slim

# Install system dependencies for OpenCV and Media processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY attendance.py attentiveness.py auth_api.py database_manager.py gunicorn_config.py ./
COPY lbfmodel.yaml face_names.json face_metadata.json face_model.yml ./
COPY .env.example .env.example

# Copy frontend build artifacts
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Expose backend port
EXPOSE 5001

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:5001/api/health || exit 1

# Start production WSGI server
CMD ["gunicorn", "-c", "gunicorn_config.py", "auth_api:app"]
