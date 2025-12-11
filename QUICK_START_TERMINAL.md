# Quick Start: Using Terminal

## Step 1: Open Terminal

**On Mac:**
- Press `Cmd + Space` (Command key + Spacebar)
- Type "Terminal"
- Press Enter

## Step 2: Navigate to Your Project

Copy and paste these commands one by one:

```bash
cd "/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)"
```

Press Enter after pasting.

## Step 3: Start Your Development Server

```bash
npm run dev
```

Or if you're using pnpm:

```bash
pnpm dev
```

Press Enter.

## Step 4: Wait for Server to Start

You should see something like:
```
▲ Next.js 16.0.7
- Local:        http://localhost:3000
```

## Step 5: Open Your Browser

- Go to: `http://localhost:3000`
- Or click the link that appears in Terminal

## Common Commands

### Stop the Server
- Press `Ctrl + C` (Control + C)

### Check if Server is Running
- Look for "Local: http://localhost:3000" in Terminal

### See All Files
```bash
ls
```

### See Hidden Files (like .env.local)
```bash
ls -la
```

## Troubleshooting

### "Command not found: npm"
- You need to install Node.js first
- Download from: https://nodejs.org/

### "Cannot find module"
- Run: `npm install` or `pnpm install`

### Port 3000 already in use
- Stop the other server running on port 3000
- Or change the port in `package.json`
