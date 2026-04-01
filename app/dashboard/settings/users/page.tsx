"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { 
  Users, 
  Search,
  MoreVertical,
} from "lucide-react"
import { useState, useEffect } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getCompanyUsers, updateUserRole, removeUser, inviteUser, getPendingInvitations, cancelInvitation } from "@/app/actions/settings-users"
import { toast } from "sonner"
import { useIsMobile } from "@/hooks/use-mobile"
import { Plus, Mail, X, Clock, CheckCircle2, Copy } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ROLES, mapLegacyRole, type EmployeeRole } from "@/lib/roles"

const SIX_ROLES: EmployeeRole[] = ["super_admin", "operations_manager", "dispatcher", "safety_compliance", "financial_controller", "driver"]

function getRoleDisplayName(rawRole: string): string {
  const mapped = mapLegacyRole(rawRole)
  return ROLES[mapped]?.name ?? rawRole
}

export default function UsersSettingsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const isMobile = useIsMobile()
  const [users, setUsers] = useState<Array<{
    id: string
    email: string
    full_name: string | null
    phone: string | null
    role: string
    status: string
  }>>([])
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [isInviting, setIsInviting] = useState(false)
  const [inviteForm, setInviteForm] = useState({
    email: "",
    role: "driver" as EmployeeRole,
  })
  const [pendingInvitations, setPendingInvitations] = useState<Array<{
    id: string
    email: string
    invitation_code: string
    status: string
    created_at: string
    expires_at: string
    accepted_at: string | null
  }>>([])
  const [inviteLinkToCopy, setInviteLinkToCopy] = useState<string | null>(null)
  const [inviteEmailError, setInviteEmailError] = useState<string | null>(null)

  useEffect(() => {
    async function loadUsers() {
      setIsLoading(true)
      try {
        const [usersResult, invitationsResult] = await Promise.all([
          getCompanyUsers(),
          getPendingInvitations(),
        ])
        
        if (usersResult.error) {
          toast.error(usersResult.error)
        } else if (usersResult.data) {
          setUsers(usersResult.data.map((u: any) => ({
            id: u.id,
            email: u.email,
            full_name: u.full_name,
            phone: u.phone,
            role: u.role,
            status: "Active",
          })))
        }

        if (invitationsResult.error) {
          console.error("Failed to load invitations:", invitationsResult.error)
        } else if (invitationsResult.data) {
          setPendingInvitations(invitationsResult.data)
        }
      } catch (error) {
        toast.error("Failed to load users")
      } finally {
        setIsLoading(false)
      }
    }
    loadUsers()
  }, [])

  const filteredUsers = users.filter(user =>
    (user.full_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleUpdateRole = async (userId: string, newRole: EmployeeRole) => {
    const result = await updateUserRole(userId, newRole)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("User role updated successfully")
      const reloadResult = await getCompanyUsers()
      if (reloadResult.data) {
        setUsers(reloadResult.data.map((u: any) => ({
          id: u.id,
          email: u.email,
          full_name: u.full_name,
          phone: u.phone,
          role: u.role,
          status: "Active",
        })))
      }
    }
  }

  const handleRemoveUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to remove ${userName}? This action cannot be undone.`)) {
      return
    }

    const result = await removeUser(userId)
    
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("User removed successfully")
      // Reload users
      const reloadResult = await getCompanyUsers()
      if (reloadResult.data) {
        setUsers(reloadResult.data.map((u: any) => ({
          id: u.id,
          email: u.email,
          full_name: u.full_name,
          phone: u.phone,
          role: u.role,
          status: "Active",
        })))
      }
    }
  }

  const handleInviteUser = async () => {
    if (!inviteForm.email || !inviteForm.role) {
      toast.error("Please fill in all fields")
      return
    }

    setIsInviting(true)
    try {
      const result = await inviteUser({
        email: inviteForm.email,
        role: inviteForm.role,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        if (result.data?.emailSent) {
          toast.success(`Invitation sent to ${inviteForm.email}`)
          setShowInviteDialog(false)
          setInviteForm({ email: "", role: "driver" })
        } else {
          toast.warning("Invitation created but email was not sent. Copy the link below to share manually.")
          setInviteLinkToCopy(result.data?.invitationLink ?? null)
          setInviteEmailError(result.data?.emailError ?? null)
        }

        // Reload invitations
        const invitationsResult = await getPendingInvitations()
        if (invitationsResult.data) {
          setPendingInvitations(invitationsResult.data)
        }
      }
    } catch (error) {
      toast.error("Failed to send invitation")
    } finally {
      setIsInviting(false)
    }
  }

  const handleCancelInvitation = async (invitationId: string, email: string) => {
    if (!confirm(`Are you sure you want to cancel the invitation for ${email}?`)) {
      return
    }

    const result = await cancelInvitation(invitationId)
    
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Invitation cancelled")
      // Reload invitations
      const invitationsResult = await getPendingInvitations()
      if (invitationsResult.data) {
        setPendingInvitations(invitationsResult.data)
      }
    }
  }

  return (
    <div className="w-full p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6" />
            Manage Users
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage user accounts and permissions
          </p>
        </div>

        {isLoading ? (
          <Card className="p-6">
            <p className="text-muted-foreground">Loading...</p>
          </Card>
        ) : (
          <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button onClick={() => setShowInviteDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Invite User
              </Button>
            </div>

            {/* Pending Invitations — only rows still awaiting registration (accepted invites are reconciled server-side) */}
            {pendingInvitations.some((i) => i.status === "pending") && (
              <div className="border rounded-lg p-4 bg-secondary/50">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Pending Invitations (
                  {pendingInvitations.filter((i) => i.status === "pending").length})
                </h3>
                <div className="space-y-2">
                  {pendingInvitations
                    .filter((invitation) => invitation.status === "pending")
                    .map((invitation) => {
                    const isExpired = new Date(invitation.expires_at) < new Date()
                    const isPending = invitation.status === "pending" && !isExpired
                    
                    return (
                      <div
                        key={invitation.id}
                        className="flex items-center justify-between p-3 bg-background rounded border"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          <div className="flex-1">
                            <p className="font-medium">{invitation.email}</p>
                            <p className="text-xs text-muted-foreground">
                              {isPending
                                ? `Expires ${new Date(invitation.expires_at).toLocaleDateString()}`
                                : invitation.status === "accepted"
                                ? `Accepted ${invitation.accepted_at ? new Date(invitation.accepted_at).toLocaleDateString() : ""}`
                                : "Expired"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={isPending ? "default" : invitation.status === "accepted" ? "secondary" : "destructive"}>
                            {isPending ? (
                              <>
                                <Clock className="w-3 h-3 mr-1" />
                                Pending
                              </>
                            ) : invitation.status === "accepted" ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Accepted
                              </>
                            ) : (
                              "Expired"
                            )}
                          </Badge>
                          {isPending && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCancelInvitation(invitation.id, invitation.email)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {isMobile ? (
              // Mobile: Card view
              <div className="space-y-3">
                {filteredUsers.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    {searchQuery ? "No users found matching your search" : "No users found"}
                  </div>
                ) : (
                  filteredUsers.map((user) => (
                    <Card key={user.id} className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-foreground">{user.full_name || "N/A"}</h3>
                            <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
                            {user.phone && (
                              <p className="text-xs text-muted-foreground mt-1">{user.phone}</p>
                            )}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {SIX_ROLES.map((r) => (
                                <DropdownMenuItem key={r} onClick={() => handleUpdateRole(user.id, r)}>
                                  Change to {ROLES[r].name}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuItem 
                                className="text-red-500"
                                onClick={() => handleRemoveUser(user.id, user.full_name || user.email)}
                              >
                                Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs">
                            {getRoleDisplayName(user.role)}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs ${
                            user.status === "Active" 
                              ? "bg-green-500/10 text-green-500" 
                              : "bg-red-500/10 text-red-500"
                          }`}>
                            {user.status}
                          </span>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            ) : (
              // Desktop: Table view
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-secondary">
                    <tr>
                      <th className="text-left p-3 font-semibold text-sm">Name</th>
                      <th className="text-left p-3 font-semibold text-sm">Email</th>
                      <th className="text-left p-3 font-semibold text-sm">Role</th>
                      <th className="text-left p-3 font-semibold text-sm">Status</th>
                      <th className="text-right p-3 font-semibold text-sm">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-muted-foreground">
                          {searchQuery ? "No users found matching your search" : "No users found"}
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user) => (
                        <tr key={user.id} className="border-t">
                          <td className="p-3">{user.full_name || "N/A"}</td>
                          <td className="p-3 text-muted-foreground">{user.email}</td>
                          <td className="p-3">
                            <span className="px-2 py-1 bg-primary/10 text-primary rounded text-sm">
                              {getRoleDisplayName(user.role)}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded text-sm ${
                              user.status === "Active" 
                                ? "bg-green-500/10 text-green-500" 
                                : "bg-red-500/10 text-red-500"
                            }`}>
                              {user.status}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {SIX_ROLES.map((r) => (
                                  <DropdownMenuItem key={r} onClick={() => handleUpdateRole(user.id, r)}>
                                    Change to {ROLES[r].name}
                                  </DropdownMenuItem>
                                ))}
                                <DropdownMenuItem 
                                  className="text-red-500"
                                  onClick={() => handleRemoveUser(user.id, user.full_name || user.email)}
                                >
                                  Remove
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
        )}

        {/* Invite User Dialog */}
        <Dialog open={showInviteDialog}         onOpenChange={(open) => {
          setShowInviteDialog(open)
          if (!open) {
            setInviteLinkToCopy(null)
            setInviteEmailError(null)
            setInviteForm({ email: "", role: "driver" })
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite User to Company</DialogTitle>
              <DialogDescription>
                {inviteLinkToCopy
                  ? "Copy the invitation link and send it to the user (email was not sent — add your Resend API key in Settings > Integration or in .env as RESEND_API_KEY)."
                  : "Send an invitation email to add a new team member to your company."}
              </DialogDescription>
            </DialogHeader>
            {inviteLinkToCopy ? (
              <div className="space-y-4 py-4">
                {inviteEmailError && (
                  <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-400">
                    <strong>Resend error:</strong> {inviteEmailError}
                  </div>
                )}
                <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                  To send to real email addresses: verify your domain at <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="underline">resend.com/domains</a>, then set <code className="rounded bg-black/10 px-1">RESEND_FROM_EMAIL</code> in <code className="rounded bg-black/10 px-1">.env</code> (e.g. <code className="rounded bg-black/10 px-1">TruckMates &lt;notifications@yourdomain.com&gt;</code>). With the default sender you can only send to Resend test addresses.
                </div>
                <div className="space-y-2">
                  <Label>Invitation link (copy and share)</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={inviteLinkToCopy}
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(inviteLinkToCopy)
                        toast.success("Link copied to clipboard")
                      }}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Email Address</Label>
                    <Input
                      type="email"
                      placeholder="user@example.com"
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select
                      value={inviteForm.role}
                      onValueChange={(value) => setInviteForm({ ...inviteForm, role: value as EmployeeRole })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        {SIX_ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {ROLES[r].name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowInviteDialog(false)
                      setInviteForm({ email: "", role: "driver" })
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleInviteUser} disabled={isInviting}>
                    {isInviting ? "Sending..." : "Send Invitation"}
                  </Button>
                </DialogFooter>
              </>
            )}
            {inviteLinkToCopy && (
              <DialogFooter>
                <Button onClick={() => { setShowInviteDialog(false); setInviteLinkToCopy(null); setInviteEmailError(null); setInviteForm({ email: "", role: "driver" }) }}>
                  Done
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

