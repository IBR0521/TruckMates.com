"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Plus, Edit2, Eye, Download, FileText, Search } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getBOLs } from "@/app/actions/bol"
import { Badge } from "@/components/ui/badge"

export default function BOLsPage() {
  const [bolsList, setBolsList] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState("")

  const loadBOLs = async () => {
    setIsLoading(true)
    const filters: any = {}
    if (statusFilter !== "all") filters.status = statusFilter

    const result = await getBOLs(filters)
    if (result.error) {
      toast.error(result.error)
      setIsLoading(false)
      return
    }
    if (result.data) {
      let filteredData = result.data
      
      // Client-side search filter
      if (searchTerm) {
        filteredData = filteredData.filter((bol) =>
          bol.bol_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          bol.shipper_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          bol.consignee_name?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      }
      
      setBolsList(filteredData)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    loadBOLs()
  }, [statusFilter])

  useEffect(() => {
    const debounce = setTimeout(() => {
      loadBOLs()
    }, 300)
    return () => clearTimeout(debounce)
  }, [searchTerm])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/50">Draft</Badge>
      case "sent":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/50">Sent</Badge>
      case "signed":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/50">Signed</Badge>
      case "delivered":
        return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/50">Delivered</Badge>
      case "completed":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/50">Completed</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  return (
    <div className="w-full">
      {/* Page Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Bill of Lading</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage digital BOLs and e-signatures</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <Link href="/dashboard/bols/create" className="flex-1 sm:flex-initial">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition w-full sm:w-auto">
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Create BOL</span>
              <span className="sm:hidden">Create</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="p-4 md:p-8">
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search BOLs by number, shipper, or consignee..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-background border-border"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px] bg-background border-border">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="signed">Signed</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* BOLs Table */}
        {isLoading ? (
          <Card className="border border-border/50 p-8 text-center">
            <p className="text-muted-foreground">Loading BOLs...</p>
          </Card>
        ) : bolsList.length === 0 ? (
          <Card className="border border-border/50 p-8 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">No BOLs found</p>
            <Link href="/dashboard/bols/create">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <Plus className="w-4 h-4 mr-2" />
                Create Your First BOL
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border bg-card/50">
                  <th className="text-left p-4 text-sm font-semibold text-foreground">BOL Number</th>
                  <th className="text-left p-4 text-sm font-semibold text-foreground">Shipper</th>
                  <th className="text-left p-4 text-sm font-semibold text-foreground">Consignee</th>
                  <th className="text-left p-4 text-sm font-semibold text-foreground">Pickup Date</th>
                  <th className="text-left p-4 text-sm font-semibold text-foreground">Status</th>
                  <th className="text-left p-4 text-sm font-semibold text-foreground">Signatures</th>
                  <th className="text-right p-4 text-sm font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bolsList.map((bol) => (
                  <tr key={bol.id} className="border-b border-border/50 hover:bg-secondary/20 transition">
                    <td className="p-4">
                      <div className="font-medium text-foreground">{bol.bol_number}</div>
                      <Link href={`/dashboard/loads/${bol.load_id}`} className="text-xs text-muted-foreground hover:text-primary">
                        View Load
                      </Link>
                    </td>
                    <td className="p-4">
                      <div className="text-foreground">{bol.shipper_name}</div>
                      {bol.shipper_city && bol.shipper_state && (
                        <div className="text-sm text-muted-foreground">{bol.shipper_city}, {bol.shipper_state}</div>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="text-foreground">{bol.consignee_name}</div>
                      {bol.consignee_city && bol.consignee_state && (
                        <div className="text-sm text-muted-foreground">{bol.consignee_city}, {bol.consignee_state}</div>
                      )}
                    </td>
                    <td className="p-4">
                      {bol.pickup_date ? (
                        <div className="text-foreground">{new Date(bol.pickup_date).toLocaleDateString()}</div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-4">{getStatusBadge(bol.status)}</td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        {bol.shipper_signature && (
                          <Badge variant="outline" className="text-xs">Shipper</Badge>
                        )}
                        {bol.driver_signature && (
                          <Badge variant="outline" className="text-xs">Driver</Badge>
                        )}
                        {bol.consignee_signature && (
                          <Badge variant="outline" className="text-xs">Consignee</Badge>
                        )}
                        {!bol.shipper_signature && !bol.driver_signature && !bol.consignee_signature && (
                          <span className="text-xs text-muted-foreground">No signatures</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/dashboard/bols/${bol.id}`}>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}


