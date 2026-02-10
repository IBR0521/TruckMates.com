# 🚀 Production Ollama Setup for TruckMates AI

## The Problem

**Vercel is serverless** - it can't run long-running processes like Ollama. When you deploy to Vercel, the AI tries to connect to `localhost:11434`, but there's no Ollama server running there.

## Solution: Host Ollama on a Separate Server

You need to run Ollama on a separate server and point your Vercel app to it.

### Option 1: DigitalOcean Droplet (Recommended - Easiest)

1. **Create a Droplet:**
   - Go to [DigitalOcean](https://www.digitalocean.com)
   - Create a new Droplet
   - Choose: Ubuntu 22.04, 4GB RAM minimum (8GB recommended)
   - Add your SSH key

2. **Install Ollama on the Droplet:**
   ```bash
   # SSH into your droplet
   ssh root@your-droplet-ip
   
   # Install Ollama
   curl -fsSL https://ollama.com/install.sh | sh
   
   # Start Ollama
   ollama serve
   
   # Download model (in a new terminal or screen session)
   ollama pull llama3.1:8b
   ```

3. **Keep Ollama Running:**
   ```bash
   # Use systemd to keep it running
   sudo systemctl enable ollama
   sudo systemctl start ollama
   ```

4. **Configure Firewall:**
   ```bash
   # Allow port 11434 (or use a reverse proxy for security)
   sudo ufw allow 11434/tcp
   ```

5. **Get Your Server IP:**
   - Note your Droplet's IP address (e.g., `123.45.67.89`)

### Option 2: AWS EC2 Instance

1. **Launch EC2 Instance:**
   - Choose: Ubuntu 22.04, t3.medium or larger
   - Configure security group to allow port 11434

2. **Install Ollama:**
   ```bash
   ssh -i your-key.pem ubuntu@your-ec2-ip
   curl -fsSL https://ollama.com/install.sh | sh
   ollama serve
   ollama pull llama3.1:8b
   ```

### Option 3: Railway/Render (Managed)

1. **Deploy Ollama as a service:**
   - Railway: Create new service, use Ollama Docker image
   - Render: Deploy Ollama as a web service
   - Get the public URL

## Configure Vercel Environment Variables

1. **Go to Vercel Dashboard:**
   - Your project → Settings → Environment Variables

2. **Add these variables:**
   ```
   OLLAMA_BASE_URL=http://your-server-ip:11434
   OLLAMA_MODEL=llama3.1:8b
   ```

   **OR if using a domain:**
   ```
   OLLAMA_BASE_URL=http://ai.yourdomain.com:11434
   OLLAMA_MODEL=llama3.1:8b
   ```

3. **Redeploy:**
   - Vercel will automatically redeploy with new environment variables

## Security Considerations

### Option A: Public Access (Simple but Less Secure)
- Allow port 11434 publicly
- Use firewall rules to restrict to Vercel IPs only

### Option B: Reverse Proxy (Recommended)
Use Nginx to add authentication:

```nginx
server {
    listen 80;
    server_name ai.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:11434;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        
        # Add basic auth
        auth_basic "Restricted";
        auth_basic_user_file /etc/nginx/.htpasswd;
    }
}
```

### Option C: VPN/Tunnel (Most Secure)
- Use Cloudflare Tunnel or Tailscale
- Keep Ollama on private network
- Connect via secure tunnel

## Quick Setup Script

Save this as `setup-ollama-server.sh`:

```bash
#!/bin/bash
# Run on your server

# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Start Ollama service
sudo systemctl enable ollama
sudo systemctl start ollama

# Wait for service to start
sleep 5

# Pull model
ollama pull llama3.1:8b

# Configure firewall (optional)
sudo ufw allow 11434/tcp

echo "✅ Ollama is running on http://$(hostname -I | awk '{print $1}'):11434"
```

## Testing

After setup, test from your local machine:

```bash
# Replace with your server IP
curl http://your-server-ip:11434/api/tags
```

Should return:
```json
{
  "models": [
    {
      "name": "llama3.1:8b",
      ...
    }
  ]
}
```

## Cost Estimate

- **DigitalOcean Droplet:** $12-24/month (4-8GB RAM)
- **AWS EC2:** $15-30/month (t3.medium)
- **Railway/Render:** $5-20/month (depending on usage)

## Next Steps

1. ✅ Set up Ollama server
2. ✅ Add `OLLAMA_BASE_URL` to Vercel environment variables
3. ✅ Redeploy your app
4. ✅ Test the AI in production

## Troubleshooting

**"Connection refused"**
- Check if Ollama is running: `systemctl status ollama`
- Check firewall: `sudo ufw status`
- Verify port is open: `curl http://localhost:11434/api/tags`

**"Model not found"**
- Pull the model: `ollama pull llama3.1:8b`
- Check models: `ollama list`

**"Timeout"**
- Increase server resources (more RAM)
- Check network connectivity
- Verify Vercel can reach your server IP


