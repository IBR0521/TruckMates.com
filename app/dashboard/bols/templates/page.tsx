"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { getBOLTemplates, createBOLTemplate, updateBOLTemplate, deleteBOLTemplate } from "@/app/actions/bol"

export default function BOLTemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [newName, setNewName] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [newDefault, setNewDefault] = useState(false)

  const loadTemplates = async () => {
    setIsLoading(true)
    const result = await getBOLTemplates()
    if (result.error) {
      toast.error(result.error)
      setIsLoading(false)
      return
    }
    setTemplates(result.data || [])
    setIsLoading(false)
  }

  useEffect(() => {
    loadTemplates()
  }, [])

  const addTemplate = async () => {
    if (!newName.trim()) return toast.error("Template name is required")
    const result = await createBOLTemplate({
      name: newName.trim(),
      description: newDesc.trim() || undefined,
      is_default: newDefault,
    })
    if (result.error) return toast.error(result.error)
    toast.success("Template created")
    setNewName("")
    setNewDesc("")
    setNewDefault(false)
    await loadTemplates()
  }

  const saveTemplate = async (tpl: any) => {
    const result = await updateBOLTemplate(tpl.id, {
      name: tpl.name,
      description: tpl.description || undefined,
      is_default: !!tpl.is_default,
    })
    if (result.error) return toast.error(result.error)
    toast.success("Template updated")
    await loadTemplates()
  }

  const removeTemplate = async (id: string) => {
    if (!confirm("Delete this template?")) return
    const result = await deleteBOLTemplate(id)
    if (result.error) return toast.error(result.error)
    toast.success("Template deleted")
    await loadTemplates()
  }

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/bols">
            <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">BOL Templates</h1>
            <p className="text-sm text-muted-foreground">Create and manage company BOL templates.</p>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-8 space-y-4">
        <Card className="p-4 border-border/60">
          <h2 className="font-semibold mb-3">New Template</h2>
          <div className="grid md:grid-cols-4 gap-2 items-center">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Template name" />
            <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Description" />
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={newDefault} onCheckedChange={(v) => setNewDefault(!!v)} />Set as default</label>
            <Button onClick={addTemplate}><Plus className="w-4 h-4 mr-2" />Add template</Button>
          </div>
        </Card>

        {isLoading ? (
          <Card className="p-8 text-center text-muted-foreground">Loading templates...</Card>
        ) : templates.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">No templates yet.</Card>
        ) : (
          <div className="space-y-3">
            {templates.map((tpl) => (
              <Card key={tpl.id} className="p-4 border-border/60">
                <div className="grid md:grid-cols-[1fr_1fr_auto_auto_auto] gap-2 items-center">
                  <Input value={tpl.name || ""} onChange={(e) => setTemplates((prev) => prev.map((x) => x.id === tpl.id ? { ...x, name: e.target.value } : x))} />
                  <Input value={tpl.description || ""} onChange={(e) => setTemplates((prev) => prev.map((x) => x.id === tpl.id ? { ...x, description: e.target.value } : x))} />
                  <label className="flex items-center gap-2 text-sm"><Checkbox checked={!!tpl.is_default} onCheckedChange={(v) => setTemplates((prev) => prev.map((x) => x.id === tpl.id ? { ...x, is_default: !!v } : x))} />Default</label>
                  <Button variant="outline" onClick={() => saveTemplate(tpl)}><Save className="w-4 h-4 mr-1" />Save</Button>
                  <Button variant="outline" onClick={() => removeTemplate(tpl.id)} className="text-red-400"><Trash2 className="w-4 h-4" /></Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
