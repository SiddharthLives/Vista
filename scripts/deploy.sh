#!/bin/bash

# Vista Platform Deployment Script
# Automates the deployment process for production environments

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOY_ENV="${1:-production}"
VERSION="${2:-latest}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if Docker is installed and running
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        log_error "Docker is not running"
        exit 1
    fi
    
    # Check if Docker Compose is available
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    # Check if environment files exist
    if [[ "$DEPLOY_ENV" == "production" ]]; then
        if [[ ! -f "$PROJECT_ROOT/backend/.env.production" ]]; then
            log_error "Production environment file not found: backend/.env.production"
            log_info "Copy backend/.env.production.example to backend/.env.production and configure it"
            exit 1
        fi
        
        if [[ ! -f "$PROJECT_ROOT/admin-web/.env.production" ]]; then
            log_error "Production environment file not found: admin-web/.env.production"
            log_info "Copy admin-web/.env.production.example to admin-web/.env.production and configure it"
            exit 1
        fi
    fi
    
    log_success "Prerequisites check passed"
}

# Build Docker images
build_images() {
    log_info "Building Docker images..."
    
    cd "$PROJECT_ROOT"
    
    # Set version for images
    export VERSION="$VERSION"
    
    # Build backend image
    log_info "Building backend image..."
    docker build -f backend/Dockerfile.prod -t "vista/api:$VERSION" backend/
    
    # Build admin web image
    log_info "Building admin web image..."
    docker build -f admin-web/Dockerfile.prod -t "vista/admin:$VERSION" admin-web/
    
    # Build Flutter web image
    log_info "Building Flutter web image..."
    docker build -f vista/Dockerfile.web -t "vista/web:$VERSION" vista/
    
    log_success "Docker images built successfully"
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    
    cd "$PROJECT_ROOT"
    
    # Check if backend container is running
    if docker-compose -f docker-compose.prod.yml ps api | grep -q "Up"; then
        docker-compose -f docker-compose.prod.yml exec api node /app/scripts/migrate-db.js migrate
    else
        log_warning "Backend container not running, skipping migrations"
    fi
    
    log_success "Database migrations completed"
}

# Deploy services
deploy_services() {
    log_info "Deploying services..."
    
    cd "$PROJECT_ROOT"
    
    # Set environment variables
    export VERSION="$VERSION"
    export DEPLOY_ENV="$DEPLOY_ENV"
    
    # Create necessary directories
    mkdir -p logs/api logs/nginx data/redis
    
    # Deploy with Docker Compose
    if [[ "$DEPLOY_ENV" == "production" ]]; then
        docker-compose -f docker-compose.prod.yml up -d
    else
        docker-compose up -d
    fi
    
    log_success "Services deployed successfully"
}

# Health check
health_check() {
    log_info "Performing health checks..."
    
    local max_attempts=30
    local attempt=1
    
    # Check API health
    while [[ $attempt -le $max_attempts ]]; do
        if curl -f -s http://localhost:3000/health > /dev/null; then
            log_success "API health check passed"
            break
        fi
        
        if [[ $attempt -eq $max_attempts ]]; then
            log_error "API health check failed after $max_attempts attempts"
            return 1
        fi
        
        log_info "API health check attempt $attempt/$max_attempts failed, retrying in 10 seconds..."
        sleep 10
        ((attempt++))
    done
    
    # Check admin interface
    attempt=1
    while [[ $attempt -le $max_attempts ]]; do
        if curl -f -s http://localhost:3001 > /dev/null; then
            log_success "Admin interface health check passed"
            break
        fi
        
        if [[ $attempt -eq $max_attempts ]]; then
            log_error "Admin interface health check failed after $max_attempts attempts"
            return 1
        fi
        
        log_info "Admin interface health check attempt $attempt/$max_attempts failed, retrying in 10 seconds..."
        sleep 10
        ((attempt++))
    done
    
    # Check web application
    attempt=1
    while [[ $attempt -le $max_attempts ]]; do
        if curl -f -s http://localhost:8080/health > /dev/null; then
            log_success "Web application health check passed"
            break
        fi
        
        if [[ $attempt -eq $max_attempts ]]; then
            log_error "Web application health check failed after $max_attempts attempts"
            return 1
        fi
        
        log_info "Web application health check attempt $attempt/$max_attempts failed, retrying in 10 seconds..."
        sleep 10
        ((attempt++))
    done
    
    log_success "All health checks passed"
}

# Cleanup old images
cleanup() {
    log_info "Cleaning up old Docker images..."
    
    # Remove dangling images
    docker image prune -f
    
    # Remove old versions (keep last 3)
    docker images vista/api --format "table {{.Tag}}" | tail -n +2 | head -n -3 | xargs -r docker rmi vista/api: 2>/dev/null || true
    docker images vista/admin --format "table {{.Tag}}" | tail -n +2 | head -n -3 | xargs -r docker rmi vista/admin: 2>/dev/null || true
    docker images vista/web --format "table {{.Tag}}" | tail -n +2 | head -n -3 | xargs -r docker rmi vista/web: 2>/dev/null || true
    
    log_success "Cleanup completed"
}

# Rollback function
rollback() {
    local previous_version="$1"
    
    if [[ -z "$previous_version" ]]; then
        log_error "Previous version not specified for rollback"
        exit 1
    fi
    
    log_warning "Rolling back to version $previous_version..."
    
    cd "$PROJECT_ROOT"
    
    export VERSION="$previous_version"
    
    if [[ "$DEPLOY_ENV" == "production" ]]; then
        docker-compose -f docker-compose.prod.yml up -d
    else
        docker-compose up -d
    fi
    
    log_success "Rollback to version $previous_version completed"
}

# Show deployment status
show_status() {
    log_info "Deployment Status:"
    echo "=================="
    
    cd "$PROJECT_ROOT"
    
    if [[ "$DEPLOY_ENV" == "production" ]]; then
        docker-compose -f docker-compose.prod.yml ps
    else
        docker-compose ps
    fi
    
    echo ""
    log_info "Service URLs:"
    echo "API: http://localhost:3000"
    echo "Admin: http://localhost:3001"
    echo "Web: http://localhost:8080"
    
    echo ""
    log_info "Logs:"
    echo "docker-compose logs -f api"
    echo "docker-compose logs -f admin"
    echo "docker-compose logs -f web"
}

# Main deployment function
deploy() {
    log_info "Starting Vista Platform deployment..."
    log_info "Environment: $DEPLOY_ENV"
    log_info "Version: $VERSION"
    
    check_prerequisites
    build_images
    deploy_services
    
    # Wait a bit for services to start
    sleep 10
    
    run_migrations
    health_check
    cleanup
    
    log_success "Deployment completed successfully!"
    show_status
}

# Show usage
show_usage() {
    echo "Usage: $0 <command> [environment] [version]"
    echo ""
    echo "Commands:"
    echo "  deploy              Deploy the platform"
    echo "  rollback <version>  Rollback to previous version"
    echo "  status              Show deployment status"
    echo "  logs <service>      Show logs for service"
    echo "  stop                Stop all services"
    echo "  restart             Restart all services"
    echo ""
    echo "Environments:"
    echo "  development (default)"
    echo "  production"
    echo ""
    echo "Examples:"
    echo "  $0 deploy production v1.0.0"
    echo "  $0 rollback v0.9.0"
    echo "  $0 status"
    echo "  $0 logs api"
}

# Main script logic
case "${1:-deploy}" in
    deploy)
        deploy
        ;;
    rollback)
        rollback "$2"
        ;;
    status)
        show_status
        ;;
    logs)
        cd "$PROJECT_ROOT"
        service="${2:-api}"
        if [[ "$DEPLOY_ENV" == "production" ]]; then
            docker-compose -f docker-compose.prod.yml logs -f "$service"
        else
            docker-compose logs -f "$service"
        fi
        ;;
    stop)
        cd "$PROJECT_ROOT"
        if [[ "$DEPLOY_ENV" == "production" ]]; then
            docker-compose -f docker-compose.prod.yml down
        else
            docker-compose down
        fi
        log_success "Services stopped"
        ;;
    restart)
        cd "$PROJECT_ROOT"
        if [[ "$DEPLOY_ENV" == "production" ]]; then
            docker-compose -f docker-compose.prod.yml restart
        else
            docker-compose restart
        fi
        log_success "Services restarted"
        ;;
    help|--help|-h)
        show_usage
        ;;
    *)
        log_error "Unknown command: $1"
        show_usage
        exit 1
        ;;
esac