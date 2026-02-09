"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Check, X, Edit2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"

interface InlineEditProps {
  value: string | number | null | undefined
  onSave: (value: string | number | null) => Promise<void>
  type?: "text" | "select" | "number" | "currency" | "date" | "email" | "phone"
  options?: { value: string; label: string }[]
  className?: string
  disabled?: boolean
  placeholder?: string
  formatValue?: (value: string | number | null | undefined) => string
  parseValue?: (value: string) => string | number | null
}

export function InlineEdit({
  value: initialValue,
  onSave,
  type = "text",
  options = [],
  className,
  disabled = false,
  placeholder = "Click to edit",
  formatValue,
  parseValue,
}: InlineEditProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState<string>(() => {
    if (formatValue) return formatValue(initialValue)
    if (type === "currency" && initialValue) return `$${Number(initialValue).toFixed(2)}`
    if (type === "date" && initialValue) {
      try {
        return format(new Date(initialValue), "yyyy-MM-dd")
      } catch {
        return String(initialValue || "")
      }
    }
    return String(initialValue || "")
  })
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const selectRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const formatted = formatValue 
      ? formatValue(initialValue)
      : type === "currency" && initialValue
        ? `$${Number(initialValue).toFixed(2)}`
        : type === "date" && initialValue
          ? (() => {
              try {
                return format(new Date(initialValue), "yyyy-MM-dd")
              } catch {
                return String(initialValue || "")
              }
            })()
          : String(initialValue || "")
    setValue(formatted)
  }, [initialValue, formatValue, type])

  useEffect(() => {
    if (isEditing && ["text", "number", "currency", "date", "email", "phone"].includes(type) && inputRef.current) {
      inputRef.current.focus()
      if (type === "currency" || type === "number") {
        // Select just the number part for currency
        const input = inputRef.current
        if (type === "currency" && input.value.startsWith("$")) {
          input.setSelectionRange(1, input.value.length)
        } else {
          input.select()
        }
      } else {
        inputRef.current.select()
      }
    }
  }, [isEditing, type])

  const handleStartEdit = () => {
    if (disabled) return
    setIsEditing(true)
  }

  const handleCancel = () => {
    const reverted = formatValue 
      ? formatValue(initialValue)
      : type === "currency" && initialValue
        ? `$${Number(initialValue).toFixed(2)}`
        : type === "date" && initialValue
          ? (() => {
              try {
                return format(new Date(initialValue), "yyyy-MM-dd")
              } catch {
                return ""
              }
            })()
          : String(initialValue || "")
    setValue(reverted)
    setIsEditing(false)
  }

  const handleSave = async () => {
    let parsedValue: string | number | null = value
    
    // Parse value based on type
    if (parseValue) {
      parsedValue = parseValue(value)
    } else if (type === "currency") {
      // Remove $ and parse as number
      const numValue = parseFloat(value.replace(/[$,]/g, ""))
      parsedValue = isNaN(numValue) ? null : numValue
    } else if (type === "number") {
      const numValue = parseFloat(value)
      parsedValue = isNaN(numValue) ? null : numValue
    } else if (type === "date") {
      parsedValue = value || null
    } else {
      parsedValue = value || null
    }

    // Check if value actually changed
    const currentFormatted = formatValue 
      ? formatValue(initialValue)
      : type === "currency" && initialValue
        ? `$${Number(initialValue).toFixed(2)}`
        : String(initialValue || "")
    
    if (value === currentFormatted) {
      setIsEditing(false)
      return
    }

    setIsSaving(true)
    try {
      await onSave(parsedValue)
      setIsEditing(false)
    } catch (error) {
      console.error("Error saving:", error)
      // Revert to initial value on error
      const reverted = formatValue 
        ? formatValue(initialValue)
        : type === "currency" && initialValue
          ? `$${Number(initialValue).toFixed(2)}`
          : String(initialValue || "")
      setValue(reverted)
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

  const getInputType = () => {
    switch (type) {
      case "number":
      case "currency":
        return "number"
      case "date":
        return "date"
      case "email":
        return "email"
      case "phone":
        return "tel"
      default:
        return "text"
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value
    if (type === "currency") {
      // Allow only numbers and decimal point
      newValue = newValue.replace(/[^0-9.]/g, "")
    }
    setValue(newValue)
  }

  const getDisplayValue = () => {
    if (formatValue) return formatValue(initialValue)
    if (type === "currency" && initialValue) {
      return `$${Number(initialValue).toFixed(2)}`
    }
    if (type === "date" && initialValue) {
      try {
        return format(new Date(initialValue), "MMM dd, yyyy")
      } catch {
        return String(initialValue || "")
      }
    }
    return String(initialValue || placeholder)
  }

  if (isEditing) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {type === "select" ? (
          <Select
            value={value}
            onValueChange={async (newValue) => {
              // Auto-save for select dropdowns - only if value actually changed
              const currentValue = String(initialValue || "")
              if (newValue !== currentValue) {
                setIsSaving(true)
                try {
                  await onSave(newValue)
                  setValue(newValue)
                  setIsEditing(false)
                } catch (error) {
                  console.error("Error saving:", error)
                  // Revert to original value on error
                  setValue(currentValue)
                } finally {
                  setIsSaving(false)
                }
              } else {
                // No change, just close
                setIsEditing(false)
              }
            }}
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
        ) : (
          <div className="relative flex-1">
            {type === "currency" && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            )}
            <Input
              ref={inputRef}
              type={getInputType()}
              value={type === "currency" ? value.replace("$", "") : value}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={isSaving}
              className={cn("h-8", type === "currency" && "pl-8")}
              placeholder={placeholder}
            />
          </div>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={handleSave}
          disabled={isSaving}
          className="h-8 w-8 p-0"
          title="Save"
        >
          <Check className="w-4 h-4 text-green-500" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCancel}
          disabled={isSaving}
          className="h-8 w-8 p-0"
          title="Cancel"
        >
          <X className="w-4 h-4 text-red-500" />
        </Button>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 group cursor-pointer hover:bg-accent/50 rounded px-2 py-1 transition-colors min-h-[32px]",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
      onClick={handleStartEdit}
    >
      <span className="flex-1 text-sm">{getDisplayValue()}</span>
      {!disabled && (
        <Edit2 className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
      )}
    </div>
  )
}










