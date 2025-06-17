#!/bin/bash

echo "🚀 Setting up Cloud Database for FileFlowMaster"

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo "❌ .env.production file not found"
    echo "Please create .env.production with your Neon database URL"
    exit 1
fi

# Load production environment
export $(grep -v '^#' .env.production | xargs)

echo "📊 Database URL: ${DATABASE_URL:0:30}..."

# Generate schema for PostgreSQL
echo "🔧 Generating PostgreSQL schema..."
npm run db:generate

# Push schema to cloud database
echo "🔗 Pushing schema to cloud database..."
npm run db:push

# Seed initial data (optional)
echo "🌱 Seeding initial data..."
node -e "
const { db } = require('./server/db.ts');
const { users } = require('./shared/schema.ts');

async function seed() {
  try {
    await db.insert(users).values({
      id: 'dev-user-123',
      email: 'dev@fileflowmaster.local',
      name: 'Dev User',
      role: 'admin',
      isActive: true
    }).onConflictDoNothing();
    
    console.log('✅ Initial user created');
  } catch (error) {
    console.log('ℹ️ User already exists or error:', error.message);
  }
}

seed().then(() => process.exit(0));
"

echo "✅ Cloud database setup complete!"
echo ""
echo "To use cloud database:"
echo "1. Copy .env.production to .env"
echo "2. Update DATABASE_URL with your Neon connection string"
echo "3. Restart the application"