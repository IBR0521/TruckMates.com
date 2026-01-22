"use client"

import { useState } from "react"
import { MessageSquare, X, Send, Lightbulb, Bug, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { createFeedback } from "@/app/actions/feedback"

export function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    type: "feedback",
    message: "",
    userEmail: "",
    userName: "",
    userSurname: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.message.trim() || formData.message.trim().length < 10) {
      toast.error("Please provide at least 10 characters of feedback")
      return
    }

    if (!formData.userEmail.trim()) {
      toast.error("Please enter your email address")
      return
    }

    if (!formData.userName.trim()) {
      toast.error("Please enter your name")
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.userEmail.trim())) {
      toast.error("Please enter a valid email address")
      return
    }

    setIsSubmitting(true)

    const result = await createFeedback({
      type: formData.type,
      title: formData.type === "feedback" 
        ? "User Feedback" 
        : formData.type === "suggestion"
        ? "User Suggestion"
        : formData.type === "bug_report"
        ? "Bug Report"
        : "Feature Request",
      message: formData.message,
      priority: "normal",
      userEmail: formData.userEmail.trim(),
      userName: formData.userName.trim(),
      userSurname: formData.userSurname.trim(),
    })

    if (result.error) {
      toast.error(result.error)
      setIsSubmitting(false)
      return
    }

    toast.success("Thank you for your feedback! We appreciate your input.")
    setFormData({ type: "feedback", message: "", userEmail: "", userName: "", userSurname: "" })
    setIsOpen(false)
    setIsSubmitting(false)
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "suggestion":
        return <Lightbulb className="w-4 h-4" />
      case "bug_report":
        return <Bug className="w-4 h-4" />
      case "feature_request":
        return <Sparkles className="w-4 h-4" />
      default:
        return <MessageSquare className="w-4 h-4" />
    }
  }

  return (
    <>
      {/* Floating Feedback Button - Positioned higher to avoid covering form buttons */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-4 sm:right-6 z-10 flex items-center gap-1.5 sm:gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-2 sm:px-4 sm:py-2.5 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 group text-sm"
        aria-label="Send feedback"
      >
        <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
        <span className="hidden md:inline font-medium">Feedback</span>
      </button>

      {/* Feedback Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Share Your Feedback
            </DialogTitle>
            <DialogDescription>
              Help us improve the platform by sharing your thoughts, suggestions, or reporting issues.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            {/* User Information */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="userName">Name *</Label>
                <Input
                  id="userName"
                  placeholder="Your name"
                  value={formData.userName}
                  onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="userSurname">Surname</Label>
                <Input
                  id="userSurname"
                  placeholder="Your surname"
                  value={formData.userSurname}
                  onChange={(e) => setFormData({ ...formData, userSurname: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="userEmail">Email *</Label>
              <Input
                id="userEmail"
                type="email"
                placeholder="your.email@example.com"
                value={formData.userEmail}
                onChange={(e) => setFormData({ ...formData, userEmail: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">What would you like to share?</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="feedback">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      General Feedback
                    </div>
                  </SelectItem>
                  <SelectItem value="suggestion">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="w-4 h-4" />
                      Suggestion
                    </div>
                  </SelectItem>
                  <SelectItem value="bug_report">
                    <div className="flex items-center gap-2">
                      <Bug className="w-4 h-4" />
                      Bug Report
                    </div>
                  </SelectItem>
                  <SelectItem value="feature_request">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Feature Request
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Your Message *</Label>
              <Textarea
                id="message"
                placeholder="Tell us what you think... Share your experience, suggestions, or any issues you've encountered."
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                required
                minLength={10}
                rows={6}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Minimum 10 characters. Be as detailed as possible.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Send className="w-4 h-4 mr-2" />
                {isSubmitting ? "Sending..." : "Send Feedback"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsOpen(false)
                  setFormData({ type: "feedback", message: "", userEmail: "", userName: "", userSurname: "" })
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

