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
EXPO_PUBLIC_PLATFORM_API_URL=http://localhost:3000
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

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
