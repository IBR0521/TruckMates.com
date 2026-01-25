"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Check, X, Edit2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface InlineEditProps {
  value: string
  onSave: (value: string) => Promise<void>
  type?: "text" | "select"
  options?: { value: string; label: string }[]
  className?: string
  disabled?: boolean
  placeholder?: string
}

export function InlineEdit({
  value: initialValue,
  onSave,
  type = "text",
  options = [],
  className,
  disabled = false,
  placeholder = "Click to edit",
}: InlineEditProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState(initialValue)
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const selectRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  useEffect(() => {
    if (isEditing && type === "text" && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing, type])

  const handleStartEdit = () => {
    if (disabled) return
    setIsEditing(true)
  }

  const handleCancel = () => {
    setValue(initialValue)
    setIsEditing(false)
  }

  const handleSave = async () => {
    if (value === initialValue) {
      setIsEditing(false)
      return
    }

    setIsSaving(true)
    try {
      await onSave(value)
      setIsEditing(false)
    } catch (error) {
      console.error("Error saving:", error)
      setValue(initialValue) // Revert on error
    } finally {
      setIsSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave()
    } else if (e.key === "Escape") {
      handleCancel()
    }
  }

  if (isEditing) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {type === "text" ? (
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            disabled={isSaving}
            className="h-8"
          />
        ) : (
          <Select
            value={value}
            onValueChange={setValue}
            disabled={isSaving}
          >
            <SelectTrigger ref={selectRef} className="h-8 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={handleSave}
          disabled={isSaving}
          className="h-8 w-8 p-0"
        >
          <Check className="w-4 h-4 text-green-500" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCancel}
          disabled={isSaving}
          className="h-8 w-8 p-0"
        >
          <X className="w-4 h-4 text-red-500" />
        </Button>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 group cursor-pointer hover:bg-accent/50 rounded px-2 py-1 transition-colors",
        className
      )}
      onClick={handleStartEdit}
    >
      <span className="flex-1">{value || placeholder}</span>
      {!disabled && (
        <Edit2 className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </div>
  )
}






