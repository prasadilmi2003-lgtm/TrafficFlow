FROM node:24-alpine AS builder

WORKDIR /app

# Install dependencies first for layer caching
COPY package*.json ./
RUN npm ci

# Copy the rest of the application
COPY . .

# Build the TypeScript code
RUN npm run build

# Production image
FROM node:24-alpine

WORKDIR /app

# Copy package.json and install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built code from the builder stage
COPY --from=builder /app/dist ./dist

# Optional: expose port and set NODE_ENV
EXPOSE 4000
ENV NODE_ENV=production

# The default command runs the compiled output
CMD ["npm", "start"]
