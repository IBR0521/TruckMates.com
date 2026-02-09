#!/bin/bash

# Deployment Script for TruckMates
# This script commits and pushes all changes

set -e  # Exit on error

echo "🚀 Starting deployment process..."

# Navigate to project directory
cd "$(dirname "$0")"

# Check git status
echo "📋 Checking git status..."
git status

# Add all changes
echo "➕ Staging all changes..."
git add -A

# Check if there are changes to commit
if git diff --cached --quiet; then
    echo "✅ No changes to commit"
else
    echo "💾 Committing changes..."
    git commit -m "Remove subscription features, add marketplace coming soon, remove realtime status

- Removed all subscription-related code and pages
- Added marketplace coming soon layer for all marketplace routes
- Removed realtime status checker and dashboard stats
- Removed subscription limit checks from drivers, employees, and ELD
- Updated landing page to remove pricing and free trial references
- Platform is now free with all features accessible
- Fixed build errors related to subscription-limits module"
    
    echo "📤 Pushing to remote..."
    git push origin main
    
    echo "✅ Push completed successfully!"
fi

# Check if Vercel CLI is available
if command -v vercel &> /dev/null || command -v npx &> /dev/null; then
    echo "🌐 Deploying to Vercel..."
    npx vercel --prod --yes || echo "⚠️  Vercel deployment skipped (may need authentication)"
else
    echo "ℹ️  Vercel CLI not found. If connected to GitHub, Vercel will auto-deploy."
fi

echo "✨ Deployment process completed!"






