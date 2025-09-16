# ./back/Dockerfile
FROM python:3.12-slim

# Install curl for healthchecks
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Speed up installs
ENV PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy app
COPY . .

# Expose port (internal)
EXPOSE 8000

# If your entrypoint is server.py with uvicorn app object inside app.py, adjust accordingly.
# Common FastAPI/uvicorn pattern:
# - app.py defines: app = FastAPI()
# - run with uvicorn app:app --host 0.0.0.0 --port 8000
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port 8000"]
