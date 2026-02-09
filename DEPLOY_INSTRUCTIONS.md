# Deployment Instructions

## Option 1: Using GitHub Personal Access Token (Recommended)

1. **Create a Personal Access Token:**
   - Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Click "Generate new token (classic)"
   - Give it a name like "TruckMates Deploy"
   - Select scopes: `repo` (full control)
   - Copy the token

2. **Update Git Remote to use HTTPS:**
   ```bash
   git remote set-url origin https://github.com/IBR0521/TruckMates.com.git
   ```

3. **Push with token:**
   ```bash
   git add -A
   git commit -m "Remove subscription features, add marketplace coming soon, remove realtime status"
   git push https://YOUR_TOKEN@github.com/IBR0521/TruckMates.com.git main
   ```
   (Replace YOUR_TOKEN with your actual token)

## Option 2: Using SSH Deploy Key

1. **Generate SSH Key:**
   ```bash
   ssh-keygen -t ed25519 -C "deploy@truckmates" -f ~/.ssh/truckmates_deploy
   ```

2. **Add Public Key to GitHub:**
   - Copy the public key: `cat ~/.ssh/truckmates_deploy.pub`
   - Go to your GitHub repo → Settings → Deploy keys
   - Click "Add deploy key"
   - Paste the public key
   - Check "Allow write access" if you want to push
   - Click "Add key"

3. **Configure SSH:**
   ```bash
   # Add to ~/.ssh/config
   Host github-truckmates
       HostName github.com
       User git
       IdentityFile ~/.ssh/truckmates_deploy
   ```

4. **Update Remote:**
   ```bash
   git remote set-url origin git@github-truckmates:IBR0521/TruckMates.com.git
   ```

5. **Push:**
   ```bash
   git add -A
   git commit -m "Remove subscription features, add marketplace coming soon, remove realtime status"
   git push origin main
   ```

## Option 3: Using GitHub CLI

1. **Install GitHub CLI:**
   ```bash
   brew install gh
   ```

2. **Authenticate:**
   ```bash
   gh auth login
   ```

3. **Push:**
   ```bash
   git add -A
   git commit -m "Remove subscription features, add marketplace coming soon, remove realtime status"
   git push origin main
   ```

## Option 4: Manual Deployment Script

Run the provided script:
```bash
chmod +x deploy.sh
./deploy.sh
```

## Vercel Deployment

If your GitHub repo is connected to Vercel, pushing to `main` will automatically trigger a deployment.

To manually deploy:
```bash
npx vercel --prod
```

## Troubleshooting

If you get authentication errors:
- Check your SSH keys: `ssh -T git@github.com`
- Check your git config: `git config --list | grep user`
- Try HTTPS instead of SSH
- Use GitHub CLI for easier authentication






