"use client"

import { useState } from "react"
import { GripVertical } from "lucide-react"
import { cn } from "@/lib/utils"

interface DraggableItem {
  id: string
  [key: string]: any
}

interface DraggableListProps<T extends DraggableItem> {
  items: T[]
  onReorder: (reorderedItems: T[]) => void
  renderItem: (item: T, index: number, isDragging: boolean) => React.ReactNode
  className?: string
  disabled?: boolean
}

export function DraggableList<T extends DraggableItem>({
  items,
  onReorder,
  renderItem,
  className,
  disabled = false,
}: DraggableListProps<T>) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (disabled) return
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("text/html", index.toString())
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    if (disabled || draggedIndex === null) return
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOverIndex(index)
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    if (disabled || draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null)
      setDragOverIndex(null)
      return
    }

    e.preventDefault()
    const newItems = [...items]
    const [draggedItem] = newItems.splice(draggedIndex, 1)
    newItems.splice(dropIndex, 0, draggedItem)

    onReorder(newItems)
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  return (
    <div className={cn("space-y-2", className)}>
      {items.map((item, index) => (
        <div
          key={item.id}
          draggable={!disabled}
          onDragStart={(e) => handleDragStart(e, index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, index)}
          onDragEnd={handleDragEnd}
          className={cn(
            "relative transition-all",
            draggedIndex === index && "opacity-50",
            dragOverIndex === index && draggedIndex !== null && "border-t-2 border-primary",
            !disabled && "cursor-move"
          )}
        >
          <div className="flex items-center gap-2">
            {!disabled && (
              <div className="flex-shrink-0 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing">
                <GripVertical className="w-5 h-5" />
              </div>
            )}
            <div className="flex-1">
              {renderItem(item, index, draggedIndex === index)}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}










