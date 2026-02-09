#!/bin/bash

# Setup script to configure git to use the deploy key

echo "🔧 Setting up deploy key configuration..."

# Ensure SSH directory exists
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Add to SSH config if not already there
if ! grep -q "github-truckmates" ~/.ssh/config 2>/dev/null; then
    echo "" >> ~/.ssh/config
    echo "Host github-truckmates" >> ~/.ssh/config
    echo "    HostName github.com" >> ~/.ssh/config
    echo "    User git" >> ~/.ssh/config
    echo "    IdentityFile ~/.ssh/truckmates_deploy" >> ~/.ssh/config
    echo "    IdentitiesOnly yes" >> ~/.ssh/config
    chmod 600 ~/.ssh/config
    echo "✅ SSH config updated"
else
    echo "ℹ️  SSH config already has github-truckmates entry"
fi

# Update git remote to use the deploy key
cd "$(dirname "$0")"
git remote set-url origin git@github-truckmates:IBR0521/TruckMates.com.git

echo "✅ Git remote updated to use deploy key"
echo ""
echo "📋 Next steps:"
echo "1. Make sure you've added the public key to GitHub Deploy Keys"
echo "2. Run: git push origin main"
echo ""






