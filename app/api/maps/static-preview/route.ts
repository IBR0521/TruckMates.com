import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

function mapsKey() {
  return (process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "").trim()
}

/**
 * Proxies Google Static Maps so the loads list can show a road preview using the
 * same server key as Directions (no NEXT_PUBLIC required for this preview).
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const key = mapsKey()
  if (!key) {
    return NextResponse.json({ error: "Maps API key not configured" }, { status: 503 })
  }

  let body: { polyline?: string; origin?: string; destination?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { polyline, origin, destination } = body
  const o = origin?.trim()
  const d = destination?.trim()

  const base = () => {
    const u = new URL("https://maps.googleapis.com/maps/api/staticmap")
    u.searchParams.set("size", "640x320")
    u.searchParams.set("scale", "2")
    u.searchParams.set("maptype", "roadmap")
    u.searchParams.set("key", key)
    return u
  }

  let u = base()
  let usePolylinePath =
    typeof polyline === "string" &&
    polyline.length > 0 &&
    !!(o && d)

  if (usePolylinePath) {
    u.searchParams.set("path", `enc:${polyline}`)
    if (u.toString().length > 16_000) {
      usePolylinePath = false
      u = base()
    }
  }

  if (!usePolylinePath && o && d) {
    u.searchParams.append("markers", `color:0x22c55e|${o}`)
    u.searchParams.append("markers", `color:0xef4444|${d}`)
  } else if (!o || !d) {
    return NextResponse.json({ error: "Missing route data" }, { status: 400 })
  }

  let imgRes = await fetch(u.toString())
  if (!imgRes.ok && usePolylinePath && o && d) {
    const u2 = base()
    u2.searchParams.append("markers", `color:0x22c55e|${o}`)
    u2.searchParams.append("markers", `color:0xef4444|${d}`)
    imgRes = await fetch(u2.toString())
  }
  if (!imgRes.ok) {
    return NextResponse.json({ error: "Static map request failed" }, { status: 502 })
  }

  const buf = await imgRes.arrayBuffer()
  return new NextResponse(buf, {
    headers: {
      "Content-Type": imgRes.headers.get("content-type") || "image/png",
      "Cache-Control": "private, max-age=3600",
    },
  })
}
