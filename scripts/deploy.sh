#!/bin/bash

# FileFlowMaster Deployment Script
# This script handles deployment to different environments

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENVIRONMENT="${1:-staging}"
VERSION="${2:-latest}"

# Default values
REGISTRY="ghcr.io"
IMAGE_NAME="fileflowmaster/fileflowmaster"
NAMESPACE="fileflowmaster"

# Environment-specific configurations
case $ENVIRONMENT in
  "staging")
    CLUSTER_NAME="fileflowmaster-staging"
    DOMAIN="staging.fileflowmaster.com"
    REPLICAS=2
    ;;
  "production")
    CLUSTER_NAME="fileflowmaster-production"
    DOMAIN="fileflowmaster.com"
    REPLICAS=3
    ;;
  *)
    echo -e "${RED}Error: Invalid environment '$ENVIRONMENT'. Use 'staging' or 'production'.${NC}"
    exit 1
    ;;
esac

# Logging function
log() {
  echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
  echo -e "${RED}[ERROR] $1${NC}"
}

success() {
  echo -e "${GREEN}[SUCCESS] $1${NC}"
}

warning() {
  echo -e "${YELLOW}[WARNING] $1${NC}"
}

# Check prerequisites
check_prerequisites() {
  log "Checking prerequisites..."
  
  # Check if required tools are installed
  local tools=("kubectl" "docker" "aws" "envsubst")
  for tool in "${tools[@]}"; do
    if ! command -v "$tool" &> /dev/null; then
      error "$tool is not installed or not in PATH"
      exit 1
    fi
  done
  
  # Check if AWS credentials are configured
  if ! aws sts get-caller-identity &> /dev/null; then
    error "AWS credentials not configured"
    exit 1
  fi
  
  # Check if kubectl can connect to cluster
  if ! kubectl cluster-info &> /dev/null; then
    error "Cannot connect to Kubernetes cluster"
    exit 1
  fi
  
  success "Prerequisites check passed"
}

# Update kubeconfig
update_kubeconfig() {
  log "Updating kubeconfig for cluster: $CLUSTER_NAME"
  
  aws eks update-kubeconfig --region us-east-1 --name "$CLUSTER_NAME"
  
  # Verify connection
  if kubectl get nodes &> /dev/null; then
    success "Successfully connected to cluster: $CLUSTER_NAME"
  else
    error "Failed to connect to cluster: $CLUSTER_NAME"
    exit 1
  fi
}

# Create namespace if it doesn't exist
create_namespace() {
  log "Ensuring namespace '$NAMESPACE' exists..."
  
  if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
    kubectl create namespace "$NAMESPACE"
    success "Created namespace: $NAMESPACE"
  else
    log "Namespace '$NAMESPACE' already exists"
  fi
}

# Build and push Docker image
build_and_push_image() {
  log "Building and pushing Docker image..."
  
  local full_image_name="$REGISTRY/$IMAGE_NAME:$VERSION"
  
  # Build image
  log "Building image: $full_image_name"
  docker build -t "$full_image_name" "$PROJECT_ROOT"
  
  # Push image
  log "Pushing image: $full_image_name"
  docker push "$full_image_name"
  
  success "Image built and pushed: $full_image_name"
  echo "$full_image_name"
}

# Deploy secrets
deploy_secrets() {
  log "Deploying secrets..."
  
  # Check if secrets exist
  if kubectl get secret fileflowmaster-secrets -n "$NAMESPACE" &> /dev/null; then
    warning "Secrets already exist. Skipping secret deployment."
    return
  fi
  
  # Read secrets from environment or prompt
  read -s -p "Enter DATABASE_URL: " DATABASE_URL
  echo
  read -s -p "Enter JWT_SECRET: " JWT_SECRET
  echo
  read -s -p "Enter ENCRYPTION_MASTER_KEY: " ENCRYPTION_MASTER_KEY
  echo
  
  # Create secret
  kubectl create secret generic fileflowmaster-secrets \
    --from-literal=database-url="$DATABASE_URL" \
    --from-literal=jwt-secret="$JWT_SECRET" \
    --from-literal=encryption-master-key="$ENCRYPTION_MASTER_KEY" \
    -n "$NAMESPACE"
  
  success "Secrets deployed"
}

# Deploy application
deploy_application() {
  local image_tag="$1"
  
  log "Deploying application with image: $image_tag"
  
  # Set environment variables for envsubst
  export IMAGE_TAG="$image_tag"
  export REPLICAS="$REPLICAS"
  export DOMAIN="$DOMAIN"
  export ENVIRONMENT="$ENVIRONMENT"
  
  # Apply deployment
  envsubst < "$PROJECT_ROOT/k8s/$ENVIRONMENT/deployment.yaml" | kubectl apply -f -
  
  success "Application deployment submitted"
}

# Wait for deployment
wait_for_deployment() {
  log "Waiting for deployment to complete..."
  
  local deployment_name="fileflowmaster-$ENVIRONMENT"
  
  if kubectl rollout status deployment/"$deployment_name" -n "$NAMESPACE" --timeout=600s; then
    success "Deployment completed successfully"
  else
    error "Deployment failed or timed out"
    
    # Show pod status for debugging
    log "Pod status:"
    kubectl get pods -n "$NAMESPACE" -l app=fileflowmaster
    
    log "Recent events:"
    kubectl get events -n "$NAMESPACE" --sort-by='.lastTimestamp' | tail -10
    
    exit 1
  fi
}

# Run health checks
run_health_checks() {
  log "Running health checks..."
  
  local service_url
  if [[ "$ENVIRONMENT" == "production" ]]; then
    service_url="https://$DOMAIN"
  else
    service_url="https://$DOMAIN"
  fi
  
  # Wait for service to be ready
  log "Waiting for service to be ready..."
  for i in {1..30}; do
    if curl -sf "$service_url/health" > /dev/null 2>&1; then
      success "Health check passed"
      return 0
    fi
    log "Health check attempt $i/30 failed, retrying in 10 seconds..."
    sleep 10
  done
  
  error "Health checks failed"
  return 1
}

# Create backup (production only)
create_backup() {
  if [[ "$ENVIRONMENT" != "production" ]]; then
    return 0
  fi
  
  log "Creating database backup before deployment..."
  
  local backup_job_name="backup-$(date +%s)"
  
  # Create backup job from cronjob
  if kubectl create job "$backup_job_name" --from=cronjob/database-backup -n "$NAMESPACE"; then
    # Wait for backup to complete
    if kubectl wait --for=condition=complete job/"$backup_job_name" -n "$NAMESPACE" --timeout=300s; then
      success "Backup completed successfully"
    else
      warning "Backup failed or timed out, but continuing with deployment"
    fi
  else
    warning "Could not create backup job, continuing with deployment"
  fi
}

# Rollback deployment
rollback_deployment() {
  log "Rolling back deployment..."
  
  local deployment_name="fileflowmaster-$ENVIRONMENT"
  
  kubectl rollout undo deployment/"$deployment_name" -n "$NAMESPACE"
  kubectl rollout status deployment/"$deployment_name" -n "$NAMESPACE" --timeout=300s
  
  success "Rollback completed"
}

# Send notification
send_notification() {
  local status="$1"
  local message="$2"
  
  if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
    local color
    case $status in
      "success") color="good" ;;
      "warning") color="warning" ;;
      "error") color="danger" ;;
      *) color="good" ;;
    esac
    
    curl -X POST -H 'Content-type: application/json' \
      --data "{\"text\":\"FileFlowMaster Deployment\", \"attachments\":[{\"color\":\"$color\", \"text\":\"$message\"}]}" \
      "$SLACK_WEBHOOK_URL" || true
  fi
}

# Cleanup function
cleanup() {
  log "Cleaning up temporary files..."
  # Add any cleanup tasks here
}

# Main deployment function
main() {
  log "Starting deployment to $ENVIRONMENT environment"
  log "Version: $VERSION"
  
  trap cleanup EXIT
  
  # Check prerequisites
  check_prerequisites
  
  # Update kubeconfig
  update_kubeconfig
  
  # Create namespace
  create_namespace
  
  # Create backup (production only)
  create_backup
  
  # Build and push image
  local image_tag
  if [[ "$VERSION" == "latest" ]]; then
    image_tag=$(build_and_push_image)
  else
    image_tag="$REGISTRY/$IMAGE_NAME:$VERSION"
  fi
  
  # Deploy secrets (if needed)
  deploy_secrets
  
  # Deploy application
  deploy_application "$image_tag"
  
  # Wait for deployment
  if wait_for_deployment; then
    # Run health checks
    if run_health_checks; then
      success "Deployment to $ENVIRONMENT completed successfully!"
      send_notification "success" "FileFlowMaster $VERSION deployed successfully to $ENVIRONMENT"
    else
      error "Health checks failed, rolling back..."
      rollback_deployment
      send_notification "error" "FileFlowMaster $VERSION deployment to $ENVIRONMENT failed health checks and was rolled back"
      exit 1
    fi
  else
    error "Deployment failed"
    send_notification "error" "FileFlowMaster $VERSION deployment to $ENVIRONMENT failed"
    exit 1
  fi
}

# Help function
show_help() {
  cat << EOF
FileFlowMaster Deployment Script

Usage: $0 [ENVIRONMENT] [VERSION]

Arguments:
  ENVIRONMENT  Target environment (staging|production) [default: staging]
  VERSION      Image version tag [default: latest]

Examples:
  $0 staging
  $0 production v1.2.3
  $0 staging latest

Environment Variables:
  SLACK_WEBHOOK_URL  Slack webhook URL for notifications (optional)

EOF
}

# Parse command line arguments
case "${1:-}" in
  -h|--help)
    show_help
    exit 0
    ;;
  *)
    main "$@"
    ;;
esac