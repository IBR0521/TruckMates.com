#!/bin/bash

# Script to prepare Next.js files for upload to Hostinger
# This excludes node_modules, .next, .git, and other unnecessary files

echo "🚀 Preparing Next.js files for upload..."

# Create upload directory
mkdir -p ../nextjs-upload
cd ../nextjs-upload

# Copy files excluding unnecessary ones
rsync -av --progress \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.git' \
  --exclude '*.log' \
  --exclude '.DS_Store' \
  --exclude '.vercel' \
  --exclude '*.tsbuildinfo' \
  --exclude '.supabase' \
  --exclude 'pnpm-lock.yaml' \
  "../logistics-saa-s-design (1)/" .

echo "✅ Files prepared in: ../nextjs-upload"
echo "📦 You can now ZIP this folder and upload to Hostinger"
echo ""
echo "To create ZIP file, run:"
echo "  cd ../nextjs-upload"
echo "  zip -r nextjs-app.zip ."
