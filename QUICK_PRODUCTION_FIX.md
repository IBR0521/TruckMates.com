# ⚡ Quick Fix: Get TruckMates AI Working in Production

## The Issue

Vercel is **serverless** - it can't run Ollama. You need to host Ollama on a **separate server**.

## Fastest Solution (15 minutes)

### Step 1: Create a DigitalOcean Droplet

1. Go to [DigitalOcean](https://www.digitalocean.com)
2. Click "Create" → "Droplets"
3. Choose:
   - **Image:** Ubuntu 22.04
   - **Plan:** Basic, 4GB RAM ($24/month) or 8GB RAM ($48/month)
   - **Region:** Choose closest to your users
   - **Authentication:** SSH key (or password)
4. Click "Create Droplet"

### Step 2: Install Ollama on the Server

SSH into your server:
```bash
ssh root@your-droplet-ip
```

Then run:
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Start Ollama as a service
sudo systemctl enable ollama
sudo systemctl start ollama

# Wait a moment
sleep 5

# Download the AI model
ollama pull llama3.1:8b

# Allow port 11434 (temporarily - you should secure this later)
sudo ufw allow 11434/tcp
```

### Step 3: Get Your Server IP

Note your Droplet's IP address (shown in DigitalOcean dashboard).

### Step 4: Configure Vercel

1. Go to [Vercel Dashboard](https://vercel.com)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add:
   - **Name:** `OLLAMA_BASE_URL`
   - **Value:** `http://YOUR-DROPLET-IP:11434` (replace with your actual IP)
   - **Environment:** Production, Preview, Development
5. Add:
   - **Name:** `OLLAMA_MODEL`
   - **Value:** `llama3.1:8b`
   - **Environment:** Production, Preview, Development
6. Click **Save**

### Step 5: Redeploy

1. Go to **Deployments** tab
2. Click the **"..."** menu on the latest deployment
3. Click **"Redeploy"**

### Step 6: Test

Wait 2-3 minutes for redeploy, then test the AI in your live app.

## Security (Do This After Testing)

**Important:** Right now your Ollama server is publicly accessible. Secure it:

### Option A: Restrict to Vercel IPs Only

```bash
# On your server
sudo ufw delete allow 11434/tcp
sudo ufw allow from VERCEL_IP to any port 11434
```

### Option B: Use Nginx with Authentication (Recommended)

```bash
# Install Nginx
sudo apt install nginx

# Create config
sudo nano /etc/nginx/sites-available/ollama
```

Add:
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:11434;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        
        # Basic auth
        auth_basic "Restricted";
        auth_basic_user_file /etc/nginx/.htpasswd;
    }
}
```

Then:
```bash
# Create password file
sudo apt install apache2-utils
sudo htpasswd -c /etc/nginx/.htpasswd ollama

# Enable site
sudo ln -s /etc/nginx/sites-available/ollama /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Update Vercel env var to use domain instead of IP
```

## Cost

- **DigitalOcean 4GB:** ~$24/month
- **DigitalOcean 8GB:** ~$48/month (recommended for better performance)

## Alternative: Use a Managed Service

If you don't want to manage a server:

1. **Railway** - Deploy Ollama as a service
2. **Render** - Similar to Railway
3. **Fly.io** - Good for Docker deployments

## Troubleshooting

**"Connection refused"**
- Check Ollama: `sudo systemctl status ollama`
- Check firewall: `sudo ufw status`
- Test locally: `curl http://localhost:11434/api/tags`

**"Model not found"**
- Pull model: `ollama pull llama3.1:8b`
- List models: `ollama list`

**Still not working?**
- Check Vercel logs for errors
- Verify environment variables are set correctly
- Make sure you redeployed after adding env vars


