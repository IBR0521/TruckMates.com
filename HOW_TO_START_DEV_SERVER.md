# How to Start Your Dev Server

## What is the Dev Server?

The dev server is what runs your Next.js app locally so you can see it in your browser at `http://localhost:3000`.

## How to Open Terminal

### On Mac:
1. **Option 1: Spotlight Search**
   - Press `Cmd + Space`
   - Type "Terminal"
   - Press Enter

2. **Option 2: Finder**
   - Open Finder
   - Go to Applications → Utilities
   - Double-click "Terminal"

3. **Option 3: VS Code/Cursor**
   - If you're using VS Code or Cursor
   - Press `` Ctrl + ` `` (backtick) to open terminal
   - Or go to: Terminal → New Terminal

## How to Start Dev Server

### Step 1: Open Terminal
- Use any method above to open Terminal

### Step 2: Navigate to Your Project
```bash
cd "/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)"
```

### Step 3: Start the Server
```bash
npm run dev
```

### Step 4: Wait for It to Start
You'll see something like:
```
▲ Next.js 16.0.7
- Local:        http://localhost:3000
- Ready in 2.3s
```

### Step 5: Open in Browser
- Open your browser
- Go to: `http://localhost:3000`
- You should see your app!

## How to Stop the Server

When you want to stop it:
- In the terminal where it's running
- Press `Ctrl + C` (or `Cmd + C` on Mac)
- The server will stop

## How to Restart the Server

1. Stop it: `Ctrl + C` (or `Cmd + C`)
2. Start it again: `npm run dev`

## Visual Guide

```
Terminal Window:
┌─────────────────────────────────────┐
│ ibrohimrahmat@MacBook ~ %           │
│ cd "/Users/ibrohimrahmat/..."       │
│ npm run dev                          │
│                                     │
│ ▲ Next.js 16.0.7                    │
│ - Local: http://localhost:3000      │
│ - Ready in 2.3s                     │
│                                     │
│ ○ Compiling / ...                   │
│ ✓ Compiled in 1.2s                  │
└─────────────────────────────────────┘
```

## Quick Commands

```bash
# Navigate to project
cd "/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)"

# Start server
npm run dev

# Stop server (when running)
Ctrl + C (or Cmd + C)

# Check if server is running
# Open browser: http://localhost:3000
```

## Troubleshooting

### "Command not found: npm"
- Node.js is not installed
- Install from: https://nodejs.org

### "Port 3000 is already in use"
- Another server is running
- Stop it first, or use a different port

### Can't find terminal
- Use VS Code/Cursor: Press `` Ctrl + ` ``
- Or use Spotlight: `Cmd + Space` → "Terminal"

