"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  MessageSquare,
  Mail,
  Phone,
  FileText,
  Plus,
  Calendar,
  User,
  ArrowRight,
  ArrowLeft,
} from "lucide-react"
import { toast } from "sonner"
import {
  getCommunicationTimeline,
  logCommunication,
  type CommunicationLog,
} from "@/app/actions/crm-communication"
import { format } from "date-fns"

interface CommunicationTimelineProps {
  customerId?: string
  vendorId?: string
  contactId?: string
}

export function CommunicationTimeline({
  customerId,
  vendorId,
  contactId,
}: CommunicationTimelineProps) {
  const [communications, setCommunications] = useState<CommunicationLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLogDialogOpen, setIsLogDialogOpen] = useState(false)
  const [logData, setLogData] = useState({
    type: "note" as CommunicationLog["type"],
    direction: "outbound" as "inbound" | "outbound",
    subject: "",
    message: "",
    occurred_at: new Date().toISOString().slice(0, 16),
  })

  useEffect(() => {
    loadCommunications()
  }, [customerId, vendorId, contactId])

  async function loadCommunications() {
    setIsLoading(true)
    try {
      const result = await getCommunicationTimeline({
        customer_id: customerId,
        vendor_id: vendorId,
        contact_id: contactId,
        limit: 50,
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        setCommunications(result.data || [])
      }
    } catch (error) {
      toast.error("Failed to load communications")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleLogCommunication() {
    if (!logData.message && !logData.subject) {
      toast.error("Please enter a message or subject")
      return
    }

    try {
      const result = await logCommunication({
        customer_id: customerId,
        vendor_id: vendorId,
        contact_id: contactId,
        type: logData.type,
        direction: logData.direction,
        subject: logData.subject || undefined,
        message: logData.message || undefined,
        occurred_at: logData.occurred_at,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Communication logged successfully")
        setIsLogDialogOpen(false)
        setLogData({
          type: "note",
          direction: "outbound",
          subject: "",
          message: "",
          occurred_at: new Date().toISOString().slice(0, 16),
        })
        loadCommunications()
      }
    } catch (error) {
      toast.error("Failed to log communication")
    }
  }

  function getTypeIcon(type: string) {
    switch (type) {
      case "email":
        return <Mail className="w-4 h-4" />
      case "phone":
        return <Phone className="w-4 h-4" />
      case "sms":
        return <MessageSquare className="w-4 h-4" />
      case "invoice_sent":
      case "payment_received":
        return <FileText className="w-4 h-4" />
      default:
        return <MessageSquare className="w-4 h-4" />
    }
  }

  function getTypeColor(type: string) {
    switch (type) {
      case "email":
        return "bg-blue-500/20 text-blue-400 border-blue-500/50"
      case "phone":
        return "bg-green-500/20 text-green-400 border-green-500/50"
      case "sms":
        return "bg-purple-500/20 text-purple-400 border-purple-500/50"
      case "invoice_sent":
        return "bg-orange-500/20 text-orange-400 border-orange-500/50"
      case "payment_received":
        return "bg-green-500/20 text-green-400 border-green-500/50"
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/50"
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Communication Timeline</h3>
        <Dialog open={isLogDialogOpen} onOpenChange={setIsLogDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Log Communication
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log Communication</DialogTitle>
              <DialogDescription>
                Record a phone call, email, meeting, or note
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Type</Label>
                <Select
                  value={logData.type}
                  onValueChange={(v) => setLogData({ ...logData, type: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="phone">Phone Call</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="note">Note</SelectItem>
                    <SelectItem value="invoice_sent">Invoice Sent</SelectItem>
                    <SelectItem value="payment_received">Payment Received</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Direction</Label>
                <Select
                  value={logData.direction}
                  onValueChange={(v) =>
                    setLogData({ ...logData, direction: v as "inbound" | "outbound" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="outbound">Outbound</SelectItem>
                    <SelectItem value="inbound">Inbound</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date & Time</Label>
                <Input
                  type="datetime-local"
                  value={logData.occurred_at}
                  onChange={(e) => setLogData({ ...logData, occurred_at: e.target.value })}
                />
              </div>
              <div>
                <Label>Subject (Optional)</Label>
                <Input
                  value={logData.subject}
                  onChange={(e) => setLogData({ ...logData, subject: e.target.value })}
                  placeholder="e.g., Follow-up on load #12345"
                />
              </div>
              <div>
                <Label>Message / Notes</Label>
                <Textarea
                  value={logData.message}
                  onChange={(e) => setLogData({ ...logData, message: e.target.value })}
                  placeholder="Enter communication details..."
                  rows={4}
                />
              </div>
              <Button onClick={handleLogCommunication} className="w-full">
                Log Communication
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Loading communications...</p>
        </Card>
      ) : communications.length === 0 ? (
        <Card className="p-8 text-center">
          <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No communications logged yet</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {communications.map((comm) => (
            <Card key={comm.id} className="p-4">
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-lg ${getTypeColor(comm.type)} flex items-center justify-center`}
                >
                  {getTypeIcon(comm.type)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={getTypeColor(comm.type)}>
                      {comm.type.replace("_", " ").toUpperCase()}
                    </Badge>
                    <Badge variant="outline" className="flex items-center gap-1">
                      {comm.direction === "outbound" ? (
                        <ArrowRight className="w-3 h-3" />
                      ) : (
                        <ArrowLeft className="w-3 h-3" />
                      )}
                      {comm.direction}
                    </Badge>
                    {comm.source !== "manual" && (
                      <Badge variant="outline" className="text-xs">
                        {comm.source}
                      </Badge>
                    )}
                  </div>
                  {comm.subject && (
                    <h4 className="font-semibold mb-1">{comm.subject}</h4>
                  )}
                  {comm.message && (
                    <p className="text-sm text-muted-foreground mb-2">{comm.message}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(comm.occurred_at), "MMM d, yyyy h:mm a")}
                    </div>
                    {comm.user_name && (
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {comm.user_name}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}


