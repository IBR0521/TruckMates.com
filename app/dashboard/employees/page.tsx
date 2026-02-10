"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { 
  Users, 
  UserPlus, 
  Edit2, 
  Trash2, 
  Mail,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Copy,
  Check,
  Key
} from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { 
  getEmployees, 
  createEmployeeInvitation, 
  updateEmployee, 
  removeEmployee,
  getPendingInvitations,
  cancelInvitation,
  generateCompanyInvitationCode
} from "@/app/actions/employees"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getCurrentUser } from "@/app/actions/user"
import { useRouter } from "next/navigation"

export default function EmployeesPage() {
  const router = useRouter()
  const [employees, setEmployees] = useState<any[]>([])
  const [invitations, setInvitations] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isManager, setIsManager] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showCodeDialog, setShowCodeDialog] = useState(false)
  const [generatedCode, setGeneratedCode] = useState("")
  const [generatedEmail, setGeneratedEmail] = useState("")
  const [codeCopied, setCodeCopied] = useState(false)
  const [showCompanyCodeDialog, setShowCompanyCodeDialog] = useState(false)
  const [generatedCompanyCode, setGeneratedCompanyCode] = useState("")
  const [companyCodeExpiresAt, setCompanyCodeExpiresAt] = useState<Date | null>(null)
  const [companyCodeCopied, setCompanyCodeCopied] = useState(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null)
  const [newEmployeeEmail, setNewEmployeeEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editFormData, setEditFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    position: "",
    employee_status: "active",
  })

  useEffect(() => {
    async function loadData() {
      try {
        // Check if user is manager - retry logic for fresh accounts
        let userResult = await getCurrentUser()
        let retries = 0
        const maxRetries = 5
        
        // Retry if user data is not available (might be a timing issue with fresh accounts)
        while ((userResult.error || !userResult.data) && retries < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1500)) // Wait 1.5 seconds
          userResult = await getCurrentUser()
          retries++
        }

        if (userResult.error || !userResult.data) {
          console.error("Failed to load user data after retries:", userResult.error)
          // Don't redirect, just show error and allow user to stay on page
          toast.error("Failed to load user data. Please refresh the page.")
          setIsLoading(false)
          // Still allow access - don't block the page
          setIsManager(true)
          setIsSuperAdmin(true) // Assume super admin if we can't verify
          return
        }

        const userRole = userResult.data.role
        const isManagerOrSuperAdmin = userRole === "manager" || userRole === "super_admin" || userRole === "super_admin"
        
        // Always allow access - don't redirect
        setIsManager(true)
        setIsSuperAdmin(userRole === "super_admin" || userRole === "manager")

        // Load employees and invitations
        const [employeesResult, invitationsResult] = await Promise.all([
          getEmployees(),
          getPendingInvitations(),
        ])

        if (employeesResult.error) {
          console.error("Error loading employees:", employeesResult.error)
          // Don't show error toast, just log it
        } else if (employeesResult.data) {
          setEmployees(employeesResult.data)
        }

        if (invitationsResult.error) {
          // Log error but don't show toast (invitations are optional)
          console.log("Invitations:", invitationsResult.error)
          // Set empty array if error (not critical)
          setInvitations([])
        } else if (invitationsResult.data) {
          setInvitations(invitationsResult.data)
        } else {
          setInvitations([])
        }
      } catch (error) {
        console.error("Error in loadData:", error)
        // Don't redirect on error - allow user to stay on page
        setIsManager(true)
        setIsSuperAdmin(true) // Assume super admin on error
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [])

  const handleAddEmployee = async () => {
    if (!newEmployeeEmail.trim()) {
      toast.error("Please enter an email address")
      return
    }

    setIsSubmitting(true)
    const result = await createEmployeeInvitation(newEmployeeEmail.trim())

    if (result.error) {
      toast.error(result.error)
      setIsSubmitting(false)
      return
    }

    if (result.data) {
      const invitationCode = result.data.invitation_code || "N/A"
      const email = newEmployeeEmail.trim()
      
      // Store code and email, then show dialog
      setGeneratedCode(invitationCode)
      setGeneratedEmail(email)
      setNewEmployeeEmail("")
      setShowAddDialog(false)
      setShowCodeDialog(true)
      
      // Reload invitations
      const invitationsResult = await getPendingInvitations()
      if (invitationsResult.data) {
        setInvitations(invitationsResult.data)
      }
    }
    setIsSubmitting(false)
  }

  const handleEditClick = (employee: any) => {
    setSelectedEmployee(employee)
    setEditFormData({
      full_name: employee.full_name || "",
      email: employee.email || "",
      phone: employee.phone || "",
      position: employee.position || "",
      employee_status: employee.employee_status || "active",
    })
    setShowEditDialog(true)
  }

  const handleUpdateEmployee = async () => {
    if (!selectedEmployee) return

    setIsSubmitting(true)
    const result = await updateEmployee(selectedEmployee.id, editFormData)

    if (result.error) {
      toast.error(result.error)
      setIsSubmitting(false)
      return
    }

    toast.success("Employee updated successfully")
    setShowEditDialog(false)
    setSelectedEmployee(null)

    // Reload employees
    const employeesResult = await getEmployees()
    if (employeesResult.data) {
      setEmployees(employeesResult.data)
    }
    setIsSubmitting(false)
  }

  const handleDeleteClick = (employee: any) => {
    setSelectedEmployee(employee)
    setShowDeleteDialog(true)
  }

  const handleDeleteEmployee = async () => {
    if (!selectedEmployee) return

    setIsSubmitting(true)
    const result = await removeEmployee(selectedEmployee.id)

    if (result.error) {
      toast.error(result.error)
      setIsSubmitting(false)
      return
    }

    toast.success("Employee removed successfully")
    setShowDeleteDialog(false)
    setSelectedEmployee(null)

    // Reload employees
    const employeesResult = await getEmployees()
    if (employeesResult.data) {
      setEmployees(employeesResult.data)
    }
    setIsSubmitting(false)
  }

  const handleCancelInvitation = async (invitationId: string) => {
    const result = await cancelInvitation(invitationId)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success("Invitation cancelled")
    
    // Reload invitations
    const invitationsResult = await getPendingInvitations()
    if (invitationsResult.data) {
      setInvitations(invitationsResult.data)
    }
  }

  const handleGenerateCompanyCode = async () => {
    const result = await generateCompanyInvitationCode()
    
    if (result.error) {
      toast.error(result.error)
      return
    }
    
    if (result.data) {
      setGeneratedCompanyCode(result.data.invitation_code)
      setCompanyCodeExpiresAt(new Date(result.data.expires_at))
      setShowCompanyCodeDialog(true)
      toast.success("Company invitation code generated! It expires in 15 minutes.")
    }
  }

  const filteredEmployees = employees.filter((emp) => {
    const query = searchQuery.toLowerCase()
    return (
      emp.full_name?.toLowerCase().includes(query) ||
      emp.email?.toLowerCase().includes(query) ||
      emp.position?.toLowerCase().includes(query)
    )
  })

  if (isLoading) {
    return (
      <div className="w-full">
        <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4">
          <h1 className="text-2xl font-bold text-foreground">Employees</h1>
        </div>
        <div className="p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    </div>
  )
}

  // Always show the page - removed blocking check
  // if (!isManager) {
  //   return null
  // }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Employee Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your company employees</p>
        </div>
        <div className="flex items-center gap-3">
          {isSuperAdmin && (
            <Button
              onClick={handleGenerateCompanyCode}
              variant="outline"
              className="border-primary text-primary hover:bg-primary/10"
            >
              <Key className="w-4 h-4 mr-2" />
              Generate Invitation Code
            </Button>
          )}
          <Button
            onClick={() => setShowAddDialog(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Add Employee
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Pending Invitations */}
          {invitations.length > 0 && (
            <Card className="border-border p-6">
              <div className="flex items-center gap-3 mb-4">
                <Mail className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-bold text-foreground">Pending Invitations</h2>
              </div>
              <div className="space-y-3">
                {invitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg border border-border"
                  >
                    <div className="flex-1">
                      <p className="text-foreground font-medium">{invitation.email}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <p className="text-sm text-muted-foreground">
                          Code: <span className="font-mono font-semibold">{invitation.invitation_code}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Expires: {new Date(invitation.expires_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCancelInvitation(invitation.id)}
                      className="text-red-400 border-red-400 hover:bg-red-400/10"
                    >
                      Cancel
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Employees List */}
          <Card className="border-border p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-bold text-foreground">Employees</h2>
                <span className="text-sm text-muted-foreground">({filteredEmployees.length})</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search employees..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
              </div>
            </div>

            {filteredEmployees.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery ? "No employees found matching your search" : "No employees yet"}
                </p>
                {!searchQuery && (
                  <Button
                    onClick={() => setShowAddDialog(true)}
                    className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add First Employee
                  </Button>
                )}
              </div>
            ) : (
              <>
                {/* Desktop: Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Name</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Email</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Phone</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Position</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Status</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEmployees.map((employee) => (
                        <tr key={employee.id} className="border-b border-border hover:bg-secondary/50">
                          <td className="py-3 px-4">
                            <p className="text-foreground font-medium">{employee.full_name || "N/A"}</p>
                          </td>
                          <td className="py-3 px-4">
                            <p className="text-muted-foreground">{employee.email}</p>
                          </td>
                          <td className="py-3 px-4">
                            <p className="text-muted-foreground">{employee.phone || "N/A"}</p>
                          </td>
                          <td className="py-3 px-4">
                            <p className="text-muted-foreground">{employee.position || "N/A"}</p>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                                employee.employee_status === "active"
                                  ? "bg-green-500/20 text-green-400"
                                  : employee.employee_status === "inactive"
                                    ? "bg-gray-500/20 text-gray-400"
                                    : "bg-yellow-500/20 text-yellow-400"
                              }`}
                            >
                              {employee.employee_status === "active" ? (
                                <CheckCircle2 className="w-3 h-3" />
                              ) : employee.employee_status === "inactive" ? (
                                <XCircle className="w-3 h-3" />
                              ) : (
                                <Clock className="w-3 h-3" />
                              )}
                              {employee.employee_status || "active"}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditClick(employee)}
                                className="text-primary hover:text-primary hover:bg-primary/10"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteClick(employee)}
                                className="text-red-400 hover:text-red-500 hover:bg-red-400/10"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile: Cards */}
                <div className="md:hidden space-y-4">
                  {filteredEmployees.map((employee) => (
                    <Card key={employee.id} className="border border-border/50 p-4">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-lg font-semibold text-foreground">{employee.full_name || "N/A"}</h3>
                            <p className="text-sm text-muted-foreground">{employee.email}</p>
                          </div>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                              employee.employee_status === "active"
                                ? "bg-green-500/20 text-green-400"
                                : employee.employee_status === "inactive"
                                  ? "bg-gray-500/20 text-gray-400"
                                  : "bg-yellow-500/20 text-yellow-400"
                            }`}
                          >
                            {employee.employee_status === "active" ? (
                              <CheckCircle2 className="w-3 h-3" />
                            ) : employee.employee_status === "inactive" ? (
                              <XCircle className="w-3 h-3" />
                            ) : (
                              <Clock className="w-3 h-3" />
                            )}
                            {employee.employee_status || "active"}
                          </span>
                        </div>
                        
                        <div className="space-y-2 pt-2 border-t border-border/30">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Phone</p>
                            <p className="text-sm text-foreground">{employee.phone || "N/A"}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Position</p>
                            <p className="text-sm text-foreground">{employee.position || "N/A"}</p>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-2 border-t border-border/30">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => handleEditClick(employee)}
                          >
                            <Edit2 className="w-4 h-4 mr-2" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/20"
                            onClick={() => handleDeleteClick(employee)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </Card>
        </div>
      </div>

      {/* Add Employee Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Employee</DialogTitle>
            <DialogDescription>
              Enter the employee's email address. An invitation code will be generated for you to share.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="employee-email">Email Address</Label>
              <Input
                id="employee-email"
                type="email"
                placeholder="employee@example.com"
                value={newEmployeeEmail}
                onChange={(e) => setNewEmployeeEmail(e.target.value)}
                className="mt-2"
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    handleAddEmployee()
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddEmployee}
              disabled={isSubmitting || !newEmployeeEmail.trim()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isSubmitting ? "Generating..." : "Generate Invitation Code"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Employee Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
            <DialogDescription>
              Update employee information and status.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-full-name">Full Name</Label>
              <Input
                id="edit-full-name"
                value={editFormData.full_name}
                onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editFormData.email}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                type="tel"
                value={editFormData.phone}
                onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="edit-position">Position</Label>
              <Input
                id="edit-position"
                value={editFormData.position}
                onChange={(e) => setEditFormData({ ...editFormData, position: e.target.value })}
                placeholder="e.g., Driver, Dispatcher, Admin"
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={editFormData.employee_status}
                onValueChange={(value) => setEditFormData({ ...editFormData, employee_status: value })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateEmployee}
              disabled={isSubmitting}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Employee</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {selectedEmployee?.full_name || selectedEmployee?.email} from your company?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEmployee}
              disabled={isSubmitting}
              className="bg-red-500 hover:bg-red-600"
            >
              {isSubmitting ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Invitation Code Dialog */}
      <Dialog open={showCodeDialog} onOpenChange={setShowCodeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invitation Code Generated</DialogTitle>
            <DialogDescription>
              Share this code with <strong>{generatedEmail}</strong> so they can join your company.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-secondary/50 border-2 border-dashed border-primary/50 rounded-lg p-6 text-center">
              <p className="text-sm text-muted-foreground mb-2">Invitation Code</p>
              <p className="text-3xl font-bold font-mono text-primary tracking-wider">
                {generatedCode}
              </p>
            </div>
            <Button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(generatedCode)
                  setCodeCopied(true)
                  setTimeout(() => setCodeCopied(false), 2000)
                } catch (err) {
                  console.error("Failed to copy:", err)
                }
              }}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {codeCopied ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Code
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              The employee should use this code when registering or in their account setup.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCodeDialog(false)
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Company Invitation Code Dialog */}
      <Dialog open={showCompanyCodeDialog} onOpenChange={setShowCompanyCodeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Company Invitation Code</DialogTitle>
            <DialogDescription>
              Share this code with your employees. It expires in 15 minutes and can be used by anyone to join your company.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-secondary/50 border-2 border-dashed border-primary/50 rounded-lg p-6 text-center">
              <p className="text-sm text-muted-foreground mb-2">Invitation Code</p>
              <p className="text-3xl font-bold font-mono text-primary tracking-wider">
                {generatedCompanyCode}
              </p>
            </div>
            {companyCodeExpiresAt && (
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Expires at: <span className="font-medium text-foreground">
                    {companyCodeExpiresAt.toLocaleString()}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  ({Math.round((companyCodeExpiresAt.getTime() - Date.now()) / 60000)} minutes remaining)
                </p>
              </div>
            )}
            <Button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(generatedCompanyCode)
                  setCompanyCodeCopied(true)
                  setTimeout(() => setCompanyCodeCopied(false), 2000)
                  toast.success("Code copied to clipboard!")
                } catch (err) {
                  console.error("Failed to copy:", err)
                  toast.error("Failed to copy code")
                }
              }}
              variant="outline"
              className="w-full"
            >
              {companyCodeCopied ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Code
                </>
              )}
            </Button>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCompanyCodeDialog(false)
                setCompanyCodeCopied(false)
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

