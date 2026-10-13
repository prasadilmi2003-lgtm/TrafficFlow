FROM node:24-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy application files and build
COPY . .
RUN npm run build

# Nginx stage for serving the frontend and proxying API
FROM nginx:alpine

# Copy built frontend assets to Nginx's web root
COPY --from=builder /app/dist /usr/share/nginx/html

# The Nginx configuration will be mounted via docker-compose or copied
# We assume docker-compose mounts it to /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
