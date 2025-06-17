#!/bin/bash

echo "🚀 Starting FileFlowMaster setup..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create uploads directories
echo "📁 Creating upload directories..."
mkdir -p uploads/temp uploads/files

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found! Creating from template..."
    cat > .env << EOL
# Database - SQLite for local development
DATABASE_URL=sqlite:./dev.db

# Security
SESSION_SECRET=dev-secret-key-$(openssl rand -hex 32)

# Replit Auth (for local development)
REPL_ID=local-dev
ISSUER_URL=https://replit.com/oidc
REPLIT_DOMAINS=localhost:5000

# Development
NODE_ENV=development
EOL
    echo "✅ Created .env file"
fi

# Initialize database
echo "🗄️  Initializing database..."
npm run db:push

echo "✅ Setup complete!"
echo ""
echo "To start the application, run:"
echo "  npm run dev"
echo ""
echo "Then open http://localhost:5000 in your browser"
