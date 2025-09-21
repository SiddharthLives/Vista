#!/bin/bash

# Development setup script for College Social Media Backend

echo "🚀 Setting up College Social Media Backend for development..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18 or higher."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18 or higher is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Navigate to backend directory
cd backend

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Copy environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please update the .env file with your configuration values"
else
    echo "✅ .env file already exists"
fi

# Check if Docker is available
if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
    echo "🐳 Docker detected. You can use 'docker-compose up -d' to start services"
else
    echo "⚠️  Docker not detected. Make sure MongoDB is running locally"
fi

echo ""
echo "🎉 Setup complete! Next steps:"
echo "1. Update backend/.env with your configuration"
echo "2. Start MongoDB (locally or with Docker)"
echo "3. Run 'npm run dev' in the backend directory"
echo ""
echo "Available commands:"
echo "  npm run dev     - Start development server"
echo "  npm test        - Run tests"
echo "  npm start       - Start production server"
echo ""
echo "Docker commands:"
echo "  docker-compose up -d        - Start all services"
echo "  docker-compose logs -f api  - View API logs"
echo "  docker-compose down         - Stop all services"