"use client"

import { Component, ReactNode } from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("ErrorBoundary caught an error:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Card className="max-w-2xl w-full p-6">
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-6 h-6 text-destructive flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h2 className="text-xl font-bold text-foreground mb-2">
                  Something went wrong
                </h2>
                <p className="text-muted-foreground mb-4">
                  {this.state.error?.message || "An unexpected error occurred"}
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      this.setState({ hasError: false, error: null })
                      window.location.reload()
                    }}
                  >
                    Reload Page
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      window.location.href = "/"
                    }}
                  >
                    Go Home
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}















