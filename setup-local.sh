#!/bin/bash

# Setup script for local development

echo "🚀 Setting up FileFlowMaster for local development..."

# Check if PostgreSQL is running
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL is not installed. Please install PostgreSQL first."
    echo "   On macOS: brew install postgresql"
    echo "   On Ubuntu: sudo apt-get install postgresql"
    exit 1
fi

# Create database if it doesn't exist
echo "📦 Creating database..."
createdb fileflowmaster 2>/dev/null || echo "Database already exists"

# Update .env with local database URL
if [ -f .env ]; then
    sed -i.bak 's|DATABASE_URL=.*|DATABASE_URL=postgresql://'"$USER"'@localhost:5432/fileflowmaster|' .env
    echo "✅ Updated DATABASE_URL in .env"
else
    echo "❌ .env file not found!"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Push database schema
echo "🗄️  Setting up database schema..."
npm run db:push

echo "✅ Setup complete! You can now run 'npm run dev' to start the application."
