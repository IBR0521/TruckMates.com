# TruckMates ELD Mobile (Driver App)

Driver-first mobile ELD application for TruckMates platform.

## Goals

- Driver-only UX (no back-office complexity)
- Real-world ELD behavior foundation (duty status, HOS logs, DVIR, events)
- Offline-first sync with queue/retry
- Clean architecture for maintainability

## Tech

- Expo + React Native + TypeScript
- Supabase Auth (`@supabase/supabase-js`)
- TruckMates platform API (`/api/eld/mobile/*`)
- AsyncStorage queue for resilient sync

## Environment

Create `.env`:

```bash
EXPO_PUBLIC_PLATFORM_API_URL=http://localhost:3004 # use the same port your platform server is running on
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Platform API URL and “connection lost” / localhost

- **iOS Simulator (Mac):** `http://localhost:3004` (or `127.0.0.1`) is correct if Next.js binds to the host (e.g. `--hostname 0.0.0.0` and port `3004`).
- **Physical phone (Expo Go):** `localhost` points at the phone, not your computer. The app rewrites `localhost` to your dev machine IP using Expo’s `hostUri` when possible. If sync still fails, set `EXPO_PUBLIC_PLATFORM_API_URL` to `http://<your-lan-ip>:3004` (same Wi‑Fi as the phone).
- **Android emulator:** `localhost` is rewritten to `10.0.2.2` automatically so the emulator reaches the host.

## Run

```bash
npm install
npm run start
```

## Current Foundation

- Auth session + driver login
- Device registration (`/api/eld/mobile/register`)
- Queue and flush for locations/logs/events
- Driver dashboard duty status controls
- Basic tab shell: Home / HOS / DVIR / Settings

## Planned Next Milestones

1. Full HOS clocks + 24-hour grid + certification workflow
2. Automated motion-based duty transitions
3. DVIR full forms and defect workflows
4. DOT inspection mode and export package
5. Background sync scheduler and richer diagnostics
