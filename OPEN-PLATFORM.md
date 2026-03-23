# Open the platform

## Why you saw "Connection Failed" / ERR_CONNECTION_RESET

- The dev server was **not running** (nothing listening on port 3000), so the browser connection was reset.
- If you used **Cursor’s built-in browser** (Simple Browser), it often cannot reach `localhost` and can show ERR_CONNECTION_RESET. Use a normal browser instead.

## Do this every time you want to open the platform

### 1. Start the server (in a terminal)

In the project folder run:

```bash
cd "/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)"
npm run dev
```

Leave this terminal open. When you see something like:

```
▲ Next.js 15.x.x
- Local: http://localhost:3000
✓ Ready in 2.5s
```

the server is ready.

### 2. Open the app in a real browser

- Open **Chrome**, **Safari**, or **Firefox** (not Cursor’s built-in browser).
- In the address bar go to: **http://localhost:3000**
- Press Enter.

The platform should load. If the server terminal is closed or you run `Ctrl+C` there, the app will stop and you’ll get connection errors again until you run `npm run dev` again.
