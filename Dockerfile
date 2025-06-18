# Multi-stage Dockerfile for FileFlowMaster
# Stage 1: Build stage
FROM node:18-alpine AS builder

# Build arguments
ARG BUILD_DATE
ARG VCS_REF
ARG VERSION

# Add labels for metadata
LABEL org.opencontainers.image.created=$BUILD_DATE \
      org.opencontainers.image.title="FileFlowMaster" \
      org.opencontainers.image.description="Enterprise file management system" \
      org.opencontainers.image.version=$VERSION \
      org.opencontainers.image.revision=$VCS_REF \
      org.opencontainers.image.vendor="FileFlowMaster Team" \
      org.opencontainers.image.licenses="MIT"

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY drizzle.config.ts ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Production stage
FROM node:18-alpine AS production

# Install security updates
RUN apk update && apk upgrade && apk add --no-cache \
    dumb-init \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S fileflowmaster -u 1001

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=fileflowmaster:nodejs /app/dist ./dist
COPY --from=builder --chown=fileflowmaster:nodejs /app/package*.json ./
COPY --from=builder --chown=fileflowmaster:nodejs /app/node_modules ./node_modules

# Copy public assets
COPY --chown=fileflowmaster:nodejs public ./public

# Create uploads directory
RUN mkdir -p /app/uploads && chown fileflowmaster:nodejs /app/uploads

# Create logs directory
RUN mkdir -p /app/logs && chown fileflowmaster:nodejs /app/logs

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV UPLOADS_DIR=/app/uploads
ENV LOGS_DIR=/app/logs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node dist/healthcheck.js || exit 1

# Switch to non-root user
USER fileflowmaster

# Expose port
EXPOSE 3000

# Start the application with dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]

# Development stage
FROM node:18-alpine AS development

WORKDIR /app

# Install development dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Install development tools
RUN npm install -g nodemon ts-node

USER node

EXPOSE 3000

CMD ["npm", "run", "dev"]