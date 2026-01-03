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
import { getCompanyUsers, updateUserRole, removeUser } from "@/app/actions/settings-users"
import { toast } from "sonner"
import { useIsMobile } from "@/hooks/use-mobile"

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

  useEffect(() => {
    async function loadUsers() {
      setIsLoading(true)
      try {
        const result = await getCompanyUsers()
        if (result.error) {
          toast.error(result.error)
        } else if (result.data) {
          setUsers(result.data.map((u: any) => ({
            id: u.id,
            email: u.email,
            full_name: u.full_name,
            phone: u.phone,
            role: u.role === "manager" ? "Manager" : u.role === "user" ? "Employee" : "Driver",
            status: "Active",
          })))
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

  const handleUpdateRole = async (userId: string, newRole: string) => {
    const roleMap: Record<string, string> = {
      "Manager": "manager",
      "Employee": "user",
      "Driver": "driver",
    }
    
    const result = await updateUserRole(userId, roleMap[newRole] || newRole.toLowerCase())
    
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("User role updated successfully")
      // Reload users
      const reloadResult = await getCompanyUsers()
      if (reloadResult.data) {
        setUsers(reloadResult.data.map((u: any) => ({
          id: u.id,
          email: u.email,
          full_name: u.full_name,
          phone: u.phone,
          role: u.role === "manager" ? "Manager" : u.role === "user" ? "Employee" : "Driver",
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
          role: u.role === "manager" ? "Manager" : u.role === "user" ? "Employee" : "Driver",
          status: "Active",
        })))
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
            </div>

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
                              <DropdownMenuItem onClick={() => handleUpdateRole(user.id, user.role === "Manager" ? "Employee" : "Manager")}>
                                Change Role
                              </DropdownMenuItem>
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
                            {user.role}
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
                              {user.role}
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
                                <DropdownMenuItem onClick={() => handleUpdateRole(user.id, user.role === "Manager" ? "Employee" : "Manager")}>
                                  Change Role
                                </DropdownMenuItem>
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
      </div>
    </div>
  )
}

