"use client"

import Image from "next/image"
import { useState, useEffect } from "react"

interface LogoProps {
  className?: string
  showText?: boolean
  size?: "sm" | "md" | "lg"
}

export function Logo({ className = "", showText = true, size = "md" }: LogoProps) {
  const [imageError, setImageError] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  
  const sizeClasses = {
    sm: "h-8 w-auto",
    md: "h-12 w-auto", 
    lg: "h-16 w-auto",
  }

  const dimensions = {
    sm: { width: 120, height: 40 },
    md: { width: 180, height: 60 },
    lg: { width: 240, height: 80 },
  }

  // Check if image exists on mount
  useEffect(() => {
    const img = new window.Image()
    img.onload = () => setImageLoaded(true)
    img.onerror = () => setImageError(true)
    img.src = "/logo.png"
  }, [])

  // Show clean text logo if image doesn't exist
  if (imageError || !imageLoaded) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="flex flex-col">
          <span className={`font-bold text-foreground ${size === "sm" ? "text-sm" : size === "md" ? "text-lg" : "text-2xl"}`} style={{ letterSpacing: "0.05em" }}>
            TRUCKMATES
          </span>
          <span className={`text-muted-foreground ${size === "sm" ? "text-[9px]" : size === "md" ? "text-[11px]" : "text-xs"} tracking-wider`} style={{ letterSpacing: "0.2em" }}>
            CARGO CREW
          </span>
        </div>
      </div>
    )
  }
  
  return (
    <div className={`flex items-center ${className}`}>
      <Image
        src="/logo.png"
        alt="TRUCKMATES - CARGO CREW"
        width={dimensions[size].width}
        height={dimensions[size].height}
        className={sizeClasses[size]}
        priority
        unoptimized
        style={{ objectFit: "contain" }}
        onError={() => setImageError(true)}
      />
    </div>
  )
}
