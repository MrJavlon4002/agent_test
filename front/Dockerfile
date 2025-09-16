# ./front/Dockerfile

# ---------- Build stage ----------
FROM node:20-alpine AS build
WORKDIR /app

# Copy and install
COPY package*.json ./
RUN npm ci

# Pass in API base at build time (from compose args)
ARG VITE_API_BASE_URL=http://api:8000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Copy source and build
COPY . .
RUN npm run build

# ---------- Serve stage ----------
FROM nginx:alpine

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy nginx config (you already have nginx.conf)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
