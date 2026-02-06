"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { 
  Filter, 
  Save, 
  Trash2, 
  Star,
  StarOff,
  X
} from "lucide-react"
import { 
  getFilterPresets, 
  saveFilterPreset, 
  deleteFilterPreset, 
  updateFilterPreset,
  getDefaultFilterPreset,
  type FilterPreset 
} from "@/app/actions/filter-presets"
import { toast } from "sonner"

interface FilterPresetsProps {
  page: string
  currentFilters: Record<string, any>
  onApplyPreset: (filters: Record<string, any>) => void
}

export function FilterPresets({ page, currentFilters, onApplyPreset }: FilterPresetsProps) {
  const [presets, setPresets] = useState<FilterPreset[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [presetName, setPresetName] = useState("")
  const [isDefault, setIsDefault] = useState(false)
  const [defaultPreset, setDefaultPreset] = useState<FilterPreset | null>(null)

  useEffect(() => {
    loadPresets()
    loadDefaultPreset()
  }, [page])

  async function loadPresets() {
    setIsLoading(true)
    try {
      const result = await getFilterPresets(page)
      if (result.error) {
        console.error("Error loading presets:", result.error)
        setPresets([])
      } else {
        setPresets(result.data || [])
      }
    } catch (error) {
      console.error("Error loading presets:", error)
      setPresets([])
    } finally {
      setIsLoading(false)
    }
  }

  async function loadDefaultPreset() {
    try {
      const result = await getDefaultFilterPreset(page)
      if (result.data) {
        setDefaultPreset(result.data)
        // Auto-apply default preset if it exists
        onApplyPreset(result.data.filters)
      }
    } catch (error) {
      console.error("Error loading default preset:", error)
    }
  }

  async function handleSavePreset() {
    if (!presetName.trim()) {
      toast.error("Please enter a preset name")
      return
    }

    try {
      const result = await saveFilterPreset({
        name: presetName,
        page,
        filters: currentFilters,
        is_default: isDefault,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Filter preset saved")
        setPresetName("")
        setIsDefault(false)
        setIsDialogOpen(false)
        loadPresets()
        if (isDefault) {
          loadDefaultPreset()
        }
      }
    } catch (error: any) {
      toast.error("Failed to save preset")
      console.error(error)
    }
  }

  async function handleDeletePreset(presetId: string) {
    if (!confirm("Are you sure you want to delete this preset?")) {
      return
    }

    try {
      const result = await deleteFilterPreset(presetId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Preset deleted")
        loadPresets()
        if (defaultPreset?.id === presetId) {
          setDefaultPreset(null)
        }
      }
    } catch (error: any) {
      toast.error("Failed to delete preset")
      console.error(error)
    }
  }

  async function handleToggleDefault(preset: FilterPreset) {
    try {
      const result = await updateFilterPreset(preset.id!, {
        is_default: !preset.is_default,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(preset.is_default ? "Removed as default" : "Set as default")
        loadPresets()
        loadDefaultPreset()
      }
    } catch (error: any) {
      toast.error("Failed to update preset")
      console.error(error)
    }
  }

  function handleApplyPreset(preset: FilterPreset) {
    onApplyPreset(preset.filters)
    toast.success(`Applied preset: ${preset.name}`)
  }

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Filter className="w-4 h-4 mr-2" />
            Presets
            {presets.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {presets.length}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Saved Presets</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {isLoading ? (
            <DropdownMenuItem disabled>Loading...</DropdownMenuItem>
          ) : presets.length === 0 ? (
            <DropdownMenuItem disabled>No presets saved</DropdownMenuItem>
          ) : (
            presets.map((preset) => (
              <div key={preset.id} className="flex items-center justify-between px-2 py-1.5 hover:bg-accent">
                <DropdownMenuItem
                  className="flex-1 cursor-pointer"
                  onClick={() => handleApplyPreset(preset)}
                >
                  <div className="flex items-center gap-2 flex-1">
                    {preset.is_default && (
                      <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                    )}
                    <span className="flex-1">{preset.name}</span>
                  </div>
                </DropdownMenuItem>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => handleToggleDefault(preset)}
                    title={preset.is_default ? "Remove as default" : "Set as default"}
                  >
                    {preset.is_default ? (
                      <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                    ) : (
                      <StarOff className="w-3 h-3" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-destructive"
                    onClick={() => handleDeletePreset(preset.id!)}
                    title="Delete preset"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))
          )}
          <DropdownMenuSeparator />
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <Save className="w-4 h-4 mr-2" />
                Save Current Filters
              </DropdownMenuItem>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Save Filter Preset</DialogTitle>
                <DialogDescription>
                  Save your current filter settings for quick access later.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="preset-name">Preset Name</Label>
                  <Input
                    id="preset-name"
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    placeholder="e.g., Active Loads, This Month"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="is-default">Set as Default</Label>
                    <p className="text-sm text-muted-foreground">
                      This preset will be automatically applied when you visit this page
                    </p>
                  </div>
                  <Switch
                    id="is-default"
                    checked={isDefault}
                    onCheckedChange={setIsDefault}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSavePreset}>
                    <Save className="w-4 h-4 mr-2" />
                    Save Preset
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}









