# Deployment Guide

This guide provides comprehensive instructions for deploying the Vista College Social Media Platform to production environments.

## Overview

The Vista platform consists of three main components:

- **Backend API**: Node.js/Express server
- **Flutter App**: Cross-platform mobile and web application
- **Admin Interface**: Next.js web application

## Deployment Architecture

### Recommended Production Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │    │       CDN       │    │   Monitoring    │
│    (nginx)      │    │   (CloudFlare)  │    │  (DataDog/New   │
└─────────┬───────┘    └─────────────────┘    │     Relic)      │
          │                                   └─────────────────┘
    ┌─────▼─────┐
    │   API     │
    │ Instances │
    │ (Docker)  │
    └─────┬─────┘
          │
    ┌─────▼─────┐    ┌─────────────┐    ┌─────────────┐
    │ MongoDB   │    │   Redis     │    │ Cloudinary  │
    │  Atlas    │    │  Cluster    │    │   Storage   │
    └───────────┘    └─────────────┘    └─────────────┘
```

## Prerequisites

### Required Services

1. **Cloud Provider** (AWS, GCP, Azure, or DigitalOcean)
2. **MongoDB Atlas** (or managed MongoDB)
3. **Redis** (managed service recommended)
4. **Firebase Project** (production configuration)
5. **Cloudinary Account** (production tier)
6. **Domain Name** and SSL certificates
7. **CI/CD Pipeline** (GitHub Actions, GitLab CI, etc.)

### Required Tools

- Docker and Docker Compose
- kubectl (for Kubernetes deployment)
- Terraform (for infrastructure as code)
- Firebase CLI
- Cloud provider CLI tools

## Environment Configuration

### Production Environment Variables

Create production environment files for each component:

#### Backend (.env.production)

```env
# Server Configuration
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Database Configuration
MONGODB_URI=mongodb+srv://prod_user:secure_password@prod-cluster.mongodb.net/vista_prod?retryWrites=true&w=majority

# JWT Configuration
JWT_SECRET=very_long_random_secret_minimum_32_characters_for_production_security
JWT_EXPIRES_IN=7d

# Firebase Configuration (Production)
FIREBASE_PROJECT_ID=vista-prod-12345
FIREBASE_PRIVATE_KEY_ID=prod_key_id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nPROD_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@vista-prod-12345.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=prod_client_id
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token

# Cloudinary Configuration (Production)
CLOUDINARY_CLOUD_NAME=vista-prod
CLOUDINARY_API_KEY=prod_api_key
CLOUDINARY_API_SECRET=prod_api_secret

# College Configuration
COLLEGE_EMAIL_DOMAIN=college.edu
COLLEGE_NAME=Your College Name

# Redis Configuration
REDIS_URL=redis://prod-redis-cluster:6379
REDIS_PASSWORD=secure_redis_password

# Security Configuration
CORS_ORIGIN=https://vista.college.edu,https://admin.vista.college.edu
HELMET_CSP_DIRECTIVES=default-src 'self'; img-src 'self' https://res.cloudinary.com; script-src 'self'

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000
RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS=true

# Logging
LOG_LEVEL=info
LOG_FILE=/var/log/vista/app.log

# Health Check
HEALTH_CHECK_ENDPOINT=/health
HEALTH_CHECK_TIMEOUT=5000

# Performance
MAX_REQUEST_SIZE=10mb
COMPRESSION_LEVEL=6
```

#### Flutter App (production config)

Update `lib/config/app_config.dart`:

```dart
class AppConfig {
  static const String environment = 'production';

  // API Configuration
  static const String baseUrl = 'https://api.vista.college.edu';
  static const String socketUrl = 'https://api.vista.college.edu';

  // App Configuration
  static const String appName = 'Vista';
  static const String collegeName = 'Your College Name';
  static const String collegeEmailDomain = 'college.edu';

  // Cloudinary Configuration
  static const String cloudinaryCloudName = 'vista-prod';

  // Performance Configuration
  static const bool enableDebugMode = false;
  static const int apiTimeoutSeconds = 30;
  static const int maxRetryAttempts = 3;

  // Feature Flags
  static const bool enableAnalytics = true;
  static const bool enableCrashReporting = true;
  static const bool enablePerformanceMonitoring = true;
}
```

#### Admin Interface (.env.production)

```env
# API Configuration
NEXT_PUBLIC_API_URL=https://api.vista.college.edu

# App Configuration
NEXT_PUBLIC_APP_NAME=Vista Admin
NEXT_PUBLIC_COLLEGE_NAME=Your College Name
NEXT_PUBLIC_ENVIRONMENT=production

# Security Configuration
NEXTAUTH_URL=https://admin.vista.college.edu
NEXTAUTH_SECRET=very_long_random_secret_for_nextauth

# Analytics
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx

# Performance
NEXT_PUBLIC_ENABLE_ANALYTICS=true
```

## Docker Configuration

### Production Dockerfiles

#### Backend Dockerfile

```dockerfile
# Multi-stage build for production
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM node:18-alpine AS production

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy node_modules from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy application code
COPY --chown=nodejs:nodejs . .

# Create logs directory
RUN mkdir -p /var/log/vista && chown nodejs:nodejs /var/log/vista

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Start application
CMD ["node", "server.js"]
```

#### Flutter Web Dockerfile

```dockerfile
FROM nginx:alpine

# Copy built Flutter web app
COPY build/web /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create nginx user
RUN adduser -D -s /bin/sh nginx

# Set permissions
RUN chown -R nginx:nginx /usr/share/nginx/html
RUN chown -R nginx:nginx /var/cache/nginx

# Switch to non-root user
USER nginx

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
```

#### Admin Interface Dockerfile

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:18-alpine AS production

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

WORKDIR /app

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3001

ENV PORT 3001

CMD ["node", "server.js"]
```

### Docker Compose for Production

```yaml
version: "3.8"

services:
  api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    image: vista/api:latest
    restart: unless-stopped
    environment:
      - NODE_ENV=production
    env_file:
      - ./backend/.env.production
    ports:
      - "3000:3000"
    volumes:
      - ./logs:/var/log/vista
    depends_on:
      - redis
    networks:
      - vista-network
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: "1.0"
          memory: 1G
        reservations:
          cpus: "0.5"
          memory: 512M

  admin:
    build:
      context: ./admin-web
      dockerfile: Dockerfile
    image: vista/admin:latest
    restart: unless-stopped
    env_file:
      - ./admin-web/.env.production
    ports:
      - "3001:3001"
    networks:
      - vista-network
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 512M

  web:
    build:
      context: ./vista
      dockerfile: Dockerfile.web
    image: vista/web:latest
    restart: unless-stopped
    ports:
      - "8080:8080"
    networks:
      - vista-network

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD}
    environment:
      - REDIS_PASSWORD=${REDIS_PASSWORD}
    volumes:
      - redis-data:/data
    networks:
      - vista-network
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 256M

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
    depends_on:
      - api
      - admin
      - web
    networks:
      - vista-network

volumes:
  redis-data:

networks:
  vista-network:
    driver: bridge
```

## Cloud Platform Deployment

### AWS Deployment

#### Using AWS ECS (Elastic Container Service)

1. **Create ECS Cluster**:

```bash
aws ecs create-cluster --cluster-name vista-prod
```

2. **Create Task Definitions**:

```json
{
  "family": "vista-api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::account:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "vista-api",
      "image": "your-account.dkr.ecr.region.amazonaws.com/vista-api:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "MONGODB_URI",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:vista/mongodb-uri"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/vista-api",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

3. **Create ECS Service**:

```bash
aws ecs create-service \
  --cluster vista-prod \
  --service-name vista-api-service \
  --task-definition vista-api:1 \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-12345],securityGroups=[sg-12345],assignPublicIp=ENABLED}"
```

#### Using AWS App Runner

```yaml
# apprunner.yaml
version: 1.0
runtime: nodejs18
build:
  commands:
    build:
      - npm ci --production
run:
  runtime-version: 18
  command: node server.js
  network:
    port: 3000
    env: PORT
  env:
    - name: NODE_ENV
      value: production
```

### Google Cloud Platform (GCP)

#### Using Cloud Run

1. **Build and push Docker image**:

```bash
# Configure Docker for GCP
gcloud auth configure-docker

# Build and tag image
docker build -t gcr.io/your-project/vista-api ./backend

# Push to Container Registry
docker push gcr.io/your-project/vista-api
```

2. **Deploy to Cloud Run**:

```bash
gcloud run deploy vista-api \
  --image gcr.io/your-project/vista-api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3000 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 10 \
  --set-env-vars NODE_ENV=production \
  --set-secrets MONGODB_URI=mongodb-uri:latest
```

#### Using Google Kubernetes Engine (GKE)

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vista-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: vista-api
  template:
    metadata:
      labels:
        app: vista-api
    spec:
      containers:
        - name: vista-api
          image: gcr.io/your-project/vista-api:latest
          ports:
            - containerPort: 3000
          env:
            - name: NODE_ENV
              value: "production"
            - name: MONGODB_URI
              valueFrom:
                secretKeyRef:
                  name: vista-secrets
                  key: mongodb-uri
          resources:
            requests:
              memory: "512Mi"
              cpu: "500m"
            limits:
              memory: "1Gi"
              cpu: "1000m"
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: vista-api-service
spec:
  selector:
    app: vista-api
  ports:
    - port: 80
      targetPort: 3000
  type: LoadBalancer
```

### DigitalOcean App Platform

```yaml
# .do/app.yaml
name: vista
services:
  - name: api
    source_dir: /backend
    github:
      repo: your-username/vista
      branch: main
    run_command: node server.js
    environment_slug: node-js
    instance_count: 2
    instance_size_slug: basic-xxs
    env:
      - key: NODE_ENV
        value: production
      - key: MONGODB_URI
        value: ${mongodb.DATABASE_URL}
        type: SECRET
    health_check:
      http_path: /health

  - name: admin
    source_dir: /admin-web
    github:
      repo: your-username/vista
      branch: main
    run_command: npm start
    environment_slug: node-js
    instance_count: 1
    instance_size_slug: basic-xxs
    env:
      - key: NEXT_PUBLIC_API_URL
        value: ${api.PUBLIC_URL}

  - name: web
    source_dir: /vista
    github:
      repo: your-username/vista
      branch: main
    run_command: nginx -g 'daemon off;'
    environment_slug: docker
    instance_count: 1
    instance_size_slug: basic-xxs

databases:
  - name: mongodb
    engine: MONGODB
    version: "5"
    size: db-s-1vcpu-1gb
```

## Flutter App Deployment

### Web Deployment

1. **Build for production**:

```bash
cd vista
flutter build web --release --web-renderer html
```

2. **Deploy to hosting service**:

#### Firebase Hosting

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Initialize Firebase hosting
firebase init hosting

# Deploy
firebase deploy --only hosting
```

#### Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod --dir=build/web
```

#### AWS S3 + CloudFront

```bash
# Sync to S3
aws s3 sync build/web s3://vista-web-bucket --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id E1234567890 --paths "/*"
```

### Android Deployment

1. **Build release APK**:

```bash
flutter build apk --release
```

2. **Build App Bundle** (recommended for Play Store):

```bash
flutter build appbundle --release
```

3. **Upload to Google Play Console**:
   - Create app listing
   - Upload app bundle
   - Configure release management
   - Submit for review

### iOS Deployment

1. **Build for iOS**:

```bash
flutter build ios --release
```

2. **Archive in Xcode**:
   - Open `ios/Runner.xcworkspace` in Xcode
   - Select "Any iOS Device" as target
   - Product → Archive
   - Upload to App Store Connect

## Database Setup

### MongoDB Atlas Production Setup

1. **Create Production Cluster**:

   - Choose appropriate tier (M10+ for production)
   - Enable backup
   - Configure security (IP whitelist, database users)
   - Set up monitoring and alerts

2. **Database Migration**:

```javascript
// migration script
const { MongoClient } = require("mongodb");

async function migrate() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();

  const db = client.db();

  // Create indexes
  await db.collection("users").createIndex({ studentId: 1 }, { unique: true });
  await db.collection("users").createIndex({ email: 1 });
  await db.collection("posts").createIndex({ createdAt: -1 });
  await db.collection("posts").createIndex({ authorStudentId: 1 });

  // Add more indexes as needed

  await client.close();
}

migrate().catch(console.error);
```

3. **Seed Data**:

```javascript
// seed script for initial admin user
const bcrypt = require("bcrypt");

async function seedAdmin() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();

  const db = client.db();

  const adminUser = {
    studentId: "ADMIN001",
    email: "admin@college.edu",
    displayName: "System Administrator",
    role: "admin",
    createdAt: new Date(),
  };

  await db.collection("users").insertOne(adminUser);
  await client.close();
}
```

## SSL/TLS Configuration

### Let's Encrypt with Certbot

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d api.vista.college.edu -d admin.vista.college.edu

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Nginx Configuration

```nginx
# /etc/nginx/sites-available/vista
server {
    listen 80;
    server_name api.vista.college.edu admin.vista.college.edu;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.vista.college.edu;

    ssl_certificate /etc/letsencrypt/live/api.vista.college.edu/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.vista.college.edu/privkey.pem;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # WebSocket support for Socket.IO
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 443 ssl http2;
    server_name admin.vista.college.edu;

    ssl_certificate /etc/letsencrypt/live/admin.vista.college.edu/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin.vista.college.edu/privkey.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## CI/CD Pipeline

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: "18"

      - name: Setup Flutter
        uses: subosito/flutter-action@v2
        with:
          flutter-version: "3.10.0"

      - name: Test Backend
        run: |
          cd backend
          npm ci
          npm test

      - name: Test Flutter
        run: |
          cd vista
          flutter pub get
          flutter test

      - name: Test Admin
        run: |
          cd admin-web
          npm ci
          npm test

  build-and-deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v1

      - name: Build and push Backend image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          ECR_REPOSITORY: vista-api
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG ./backend
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG

      - name: Build Flutter Web
        run: |
          cd vista
          flutter pub get
          flutter build web --release

      - name: Deploy to S3
        run: |
          aws s3 sync vista/build/web s3://vista-web-bucket --delete

      - name: Update ECS service
        run: |
          aws ecs update-service --cluster vista-prod --service vista-api-service --force-new-deployment
```

## Monitoring and Logging

### Application Monitoring

#### Health Check Endpoints

```javascript
// backend/healthcheck.js
const http = require("http");
const mongoose = require("mongoose");

const options = {
  hostname: "localhost",
  port: 3000,
  path: "/health",
  method: "GET",
  timeout: 3000,
};

const req = http.request(options, (res) => {
  if (res.statusCode === 200) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

req.on("error", () => {
  process.exit(1);
});

req.on("timeout", () => {
  req.destroy();
  process.exit(1);
});

req.end();
```

```javascript
// backend/routes/health.js
const express = require("express");
const mongoose = require("mongoose");
const redis = require("../config/redis");

const router = express.Router();

router.get("/health", async (req, res) => {
  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version,
  };

  try {
    // Check database connection
    if (mongoose.connection.readyState !== 1) {
      throw new Error("Database not connected");
    }
    health.database = "connected";

    // Check Redis connection
    await redis.ping();
    health.redis = "connected";

    res.status(200).json(health);
  } catch (error) {
    health.status = "error";
    health.error = error.message;
    res.status(503).json(health);
  }
});

module.exports = router;
```

#### Logging Configuration

```javascript
// backend/config/logger.js
const winston = require("winston");

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: "vista-api" },
  transports: [
    new winston.transports.File({
      filename: "/var/log/vista/error.log",
      level: "error",
    }),
    new winston.transports.File({
      filename: "/var/log/vista/app.log",
    }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    })
  );
}

module.exports = logger;
```

### Performance Monitoring

#### New Relic Integration

```javascript
// Add to top of server.js
require("newrelic");

// Install: npm install newrelic
// Configure: newrelic.js file with license key
```

#### DataDog Integration

```javascript
// backend/config/datadog.js
const tracer = require("dd-trace").init({
  service: "vista-api",
  env: process.env.NODE_ENV,
  version: process.env.npm_package_version,
});

module.exports = tracer;
```

## Security Considerations

### Production Security Checklist

- [ ] **Environment Variables**: All secrets in environment variables
- [ ] **HTTPS**: SSL/TLS certificates configured
- [ ] **Database Security**: Authentication enabled, IP whitelist configured
- [ ] **Rate Limiting**: Implemented on all endpoints
- [ ] **Input Validation**: All inputs validated and sanitized
- [ ] **CORS**: Properly configured for production domains
- [ ] **Security Headers**: Helmet.js configured
- [ ] **Dependency Updates**: Regular security updates
- [ ] **Secrets Management**: Use AWS Secrets Manager, Azure Key Vault, etc.
- [ ] **Firewall**: Network security groups configured
- [ ] **Monitoring**: Security monitoring and alerting enabled

### Security Headers Configuration

```javascript
// backend/middleware/security.js
const helmet = require("helmet");

const securityMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "https://res.cloudinary.com", "data:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https://api.vista.college.edu"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});

module.exports = securityMiddleware;
```

## Backup and Disaster Recovery

### Database Backup

```bash
# MongoDB Atlas automatic backups are enabled by default
# For manual backups:
mongodump --uri="mongodb+srv://user:pass@cluster.mongodb.net/vista_prod" --out=/backups/$(date +%Y%m%d)
```

### Application Backup

```bash
#!/bin/bash
# backup-script.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/vista_$DATE"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
mongodump --uri="$MONGODB_URI" --out="$BACKUP_DIR/database"

# Backup uploaded files (if stored locally)
tar -czf "$BACKUP_DIR/uploads.tar.gz" /var/uploads

# Backup logs
tar -czf "$BACKUP_DIR/logs.tar.gz" /var/log/vista

# Upload to S3
aws s3 sync $BACKUP_DIR s3://vista-backups/$(date +%Y/%m/%d)/

# Cleanup old local backups (keep 7 days)
find /backups -name "vista_*" -mtime +7 -exec rm -rf {} \;
```

## Scaling Considerations

### Horizontal Scaling

1. **Load Balancer Configuration**
2. **Database Read Replicas**
3. **Redis Cluster for Session Storage**
4. **CDN for Static Assets**
5. **Auto-scaling Groups**

### Performance Optimization

```javascript
// backend/config/performance.js
const compression = require("compression");
const cluster = require("cluster");
const numCPUs = require("os").cpus().length;

if (cluster.isMaster && process.env.NODE_ENV === "production") {
  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died`);
    cluster.fork();
  });
} else {
  // Worker process
  const app = require("./app");

  // Enable compression
  app.use(
    compression({
      level: 6,
      threshold: 1024,
    })
  );

  app.listen(process.env.PORT || 3000);
}
```

## Troubleshooting

### Common Deployment Issues

1. **Container Won't Start**

   - Check environment variables
   - Verify Docker image build
   - Check application logs

2. **Database Connection Issues**

   - Verify connection string
   - Check network security groups
   - Verify database credentials

3. **SSL Certificate Issues**

   - Check certificate expiration
   - Verify domain configuration
   - Check DNS settings

4. **Performance Issues**
   - Monitor resource usage
   - Check database indexes
   - Review application logs

### Rollback Procedures

```bash
# ECS rollback
aws ecs update-service --cluster vista-prod --service vista-api-service --task-definition vista-api:previous-version

# Kubernetes rollback
kubectl rollout undo deployment/vista-api

# Docker Compose rollback
docker-compose down
git checkout previous-commit
docker-compose up -d
```

## Post-Deployment Checklist

- [ ] **Health Checks**: All services responding to health checks
- [ ] **SSL Certificates**: HTTPS working correctly
- [ ] **Database**: Connections working, indexes created
- [ ] **Authentication**: Firebase authentication working
- [ ] **File Uploads**: Cloudinary integration working
- [ ] **Real-time Features**: Socket.IO connections working
- [ ] **Monitoring**: Logging and monitoring configured
- [ ] **Backups**: Backup procedures tested
- [ ] **Performance**: Load testing completed
- [ ] **Security**: Security scan completed

## Maintenance

### Regular Maintenance Tasks

1. **Weekly**:

   - Review application logs
   - Check system resource usage
   - Verify backup integrity

2. **Monthly**:

   - Update dependencies
   - Review security alerts
   - Performance optimization review

3. **Quarterly**:
   - Security audit
   - Disaster recovery testing
   - Capacity planning review

This deployment guide provides a comprehensive approach to deploying the Vista platform in production. Adjust the specific configurations based on your chosen cloud provider and requirements.
