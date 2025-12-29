"use client"

import { useRef, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { X } from "lucide-react"

interface SignatureCaptureProps {
  onSave: (signatureData: { signature_url: string; signed_by: string; signed_at: string }) => void
  onCancel: () => void
  signerName: string
  signerNameLabel: string
  title: string
}

export function SignatureCapture({ onSave, onCancel, signerName, signerNameLabel, title }: SignatureCaptureProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [signer, setSigner] = useState(signerName)
  const [hasSignature, setHasSignature] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas size
    canvas.width = 600
    canvas.height = 200

    // Set drawing style
    ctx.strokeStyle = "#000000"
    ctx.lineWidth = 2
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
  }, [])

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    setIsDrawing(true)
    const rect = canvas.getBoundingClientRect()
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top

    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top

    ctx.lineTo(x, y)
    ctx.stroke()
    setHasSignature(true)
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clearSignature = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
  }

  const saveSignature = () => {
    if (!signer.trim()) {
      alert("Please enter the signer's name")
      return
    }

    if (!hasSignature) {
      alert("Please provide a signature")
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return

    // Convert canvas to data URL (base64 image)
    const signatureUrl = canvas.toDataURL("image/png")

    onSave({
      signature_url: signatureUrl,
      signed_by: signer.trim(),
      signed_at: new Date().toISOString(),
    })
  }

  return (
    <Card className="border-border p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            {signerNameLabel} *
          </label>
          <input
            type="text"
            value={signer}
            onChange={(e) => setSigner(e.target.value)}
            placeholder="Enter signer's full name"
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            Signature *
          </label>
          <div className="border-2 border-border rounded-md bg-white">
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="w-full cursor-crosshair touch-none"
              style={{ height: "200px", display: "block" }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Sign in the box above using your mouse or touch screen
          </p>
        </div>

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={clearSignature}>
            Clear
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" onClick={saveSignature} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            Save Signature
          </Button>
        </div>
      </div>
    </Card>
  )
}

