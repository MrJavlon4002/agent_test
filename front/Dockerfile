FROM node:20-alpine AS builder
WORKDIR /app

# Install deps
COPY package*.json ./
RUN npm ci --no-audit --no-fund

# Build
COPY . .
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

# --- Runner ---
FROM nginx:1.27-alpine

# SPA routing & gzip
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Static assets
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK CMD wget -q -O - http://localhost/ || exit 1