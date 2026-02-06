#!/bin/bash

# Generate deploy key for GitHub
KEY_PATH="$HOME/.ssh/truckmates_deploy"

echo "🔑 Generating deploy key..."

# Generate the key if it doesn't exist
if [ ! -f "$KEY_PATH" ]; then
    ssh-keygen -t ed25519 -C "truckmates-deploy" -f "$KEY_PATH" -N "" -q
    echo "✅ Key generated at: $KEY_PATH"
else
    echo "ℹ️  Key already exists at: $KEY_PATH"
fi

# Display the public key
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 COPY THIS PUBLIC KEY TO GITHUB:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
cat "$KEY_PATH.pub"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Instructions:"
echo "1. Copy the key above (starts with 'ssh-ed25519')"
echo "2. Go to: https://github.com/IBR0521/TruckMates.com/settings/keys"
echo "3. Click 'Add deploy key'"
echo "4. Title: 'TruckMates Deploy Key'"
echo "5. Paste the key"
echo "6. ✅ Check 'Allow write access'"
echo "7. Click 'Add key'"
echo ""
echo "After adding the key, run: ./setup-deploy.sh"
echo ""





