"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Plus, Truck, Trash2 } from "lucide-react"
import { getTrailers, deleteTrailer, updateTrailer } from "@/app/actions/trailers"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function TrailersPage() {
  const [trailers, setTrailers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  const loadTrailers = async () => {
    setLoading(true)
    const result = await getTrailers()
    if (result.error) {
      toast.error(result.error)
    } else {
      setTrailers(result.data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    void loadTrailers()
  }, [])

  const filtered = trailers.filter((t) => {
    const q = search.toLowerCase()
    return (
      (t.trailer_number || "").toLowerCase().includes(q) ||
      (t.vin || "").toLowerCase().includes(q) ||
      (t.plate_number || "").toLowerCase().includes(q)
    )
  })

  const onDelete = async (id: string) => {
    const result = await deleteTrailer(id)
    if (result.error) toast.error(result.error)
    else {
      toast.success("Trailer deleted")
      await loadTrailers()
    }
  }

  const onStatusChange = async (id: string, status: string) => {
    const result = await updateTrailer(id, { status })
    if (result.error) toast.error(result.error)
    else {
      toast.success("Trailer updated")
      await loadTrailers()
    }
  }

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 px-4 md:px-8 py-4 md:py-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Vehicles</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage trucks and trailers</p>
        </div>
        <Link href="/dashboard/trailers/add">
          <Button><Plus className="w-4 h-4 mr-2" />Add Trailer</Button>
        </Link>
      </div>

      <div className="p-4 md:p-8 space-y-4">
        <Tabs value="trailers">
          <TabsList>
            <TabsTrigger value="trucks" asChild><Link href="/dashboard/trucks">Trucks</Link></TabsTrigger>
            <TabsTrigger value="trailers">Trailers</TabsTrigger>
          </TabsList>
        </Tabs>

        <Card className="p-4">
          <Label>Search</Label>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Trailer number, VIN, plate..." className="mt-2" />
        </Card>

        {loading ? (
          <Card className="p-8 text-center text-muted-foreground">Loading trailers...</Card>
        ) : filtered.length === 0 ? (
          <Card className="p-8 text-center">
            <Truck className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">No trailers found.</p>
          </Card>
        ) : (
          <div className="grid gap-3">
            {filtered.map((t) => (
              <Card key={t.id} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <p className="font-semibold">{t.trailer_number}</p>
                  <p className="text-sm text-muted-foreground">
                    {t.trailer_type || "other"} {t.make ? `• ${t.make} ${t.model || ""}` : ""} {t.year ? `• ${t.year}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={t.status || "available"} onValueChange={(v) => void onStatusChange(t.id, v)}>
                    <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="in_use">In Use</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="out_of_service">Out of Service</SelectItem>
                      <SelectItem value="retired">Retired</SelectItem>
                    </SelectContent>
                  </Select>
                  <Link href={`/dashboard/trailers/${t.id}/edit`}>
                    <Button variant="outline">Edit</Button>
                  </Link>
                  <Button variant="destructive" onClick={() => void onDelete(t.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
