"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import {
  BarChart3,
  Truck,
  Users,
  Settings,
  ChevronDown,
  X,
  FileText,
  FileCheck,
  DollarSign,
  Wrench,
  FolderOpen,
  Receipt,
  UserCog,
  User,
  Shield,
  Upload,
  Radio,
  Building2,
  Store,
  MapPin,
  Contact,
  ChevronLeft,
  ChevronRight,
  Bell,
  Package,
  Calendar,
  MessageSquare,
  Sparkles,
  Bot,
  Clock,
  PlugZap,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Logo } from "@/components/logo"
import { getCurrentUser } from "@/lib/auth/server"
import { createClient as createBrowserClient } from "@/lib/supabase/client"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { mapLegacyRole, type EmployeeRole } from "@/lib/roles"
import { canViewFeature, canCreateFeature } from "@/lib/feature-permissions"
import { getEldConnectionCount } from "@/app/actions/eld-wizard"
import { useDashboardShell } from "@/components/dashboard/shell-bootstrap-provider"

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
  isCollapsed: boolean
  onCollapseToggle: () => void
}

type CurrentUserData = {
  role?: string | null
  employee_role?: string | null
  company_id?: string | null
}

export default function Sidebar({ isOpen, onToggle, isCollapsed, onCollapseToggle }: SidebarProps) {
  const pathname = usePathname()
  const autoExpandedForPath = useRef<string | null>(null)
  const [driversOpen, setDriversOpen] = useState(false)
  const [vehiclesOpen, setVehiclesOpen] = useState(false)
  const [routesOpen, setRoutesOpen] = useState(false)
  const [loadsOpen, setLoadsOpen] = useState(false)
  const [accountingOpen, setAccountingOpen] = useState(false)
  const [payablesOpen, setPayablesOpen] = useState(false)
  const [maintenanceOpen, setMaintenanceOpen] = useState(false)
  const [reportsOpen, setReportsOpen] = useState(false)
  const [crmOpen, setCrmOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [eldOpen, setEldOpen] = useState(false)
  const [complianceOpen, setComplianceOpen] = useState(false)
  const [isManager, setIsManager] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isDesktop, setIsDesktop] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [userRole, setUserRole] = useState<EmployeeRole | null>(null)
  const [managerCompanyId, setManagerCompanyId] = useState<string | null>(null)
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0)
  const [showEldConnectHint, setShowEldConnectHint] = useState(false)
  const [aiAssistantPlanBadge, setAiAssistantPlanBadge] = useState<string | null>("Pro")
  const shell = useDashboardShell()
  const LAST_ROLE_KEY = "tm:lastKnownUserRole"

  // Check if we're on desktop (lg breakpoint = 1024px) - client only
  useEffect(() => {
    setMounted(true)
    if (typeof window === "undefined") return
    
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024)
    }
    checkDesktop()
    window.addEventListener("resize", checkDesktop)
    return () => window.removeEventListener("resize", checkDesktop)
  }, [])

  // Only collapse on desktop - on mobile/tablet always show full sidebar
  const shouldShowCollapsed = isCollapsed && isDesktop

  useEffect(() => {
    const isCreationPage =
      pathname === "/dashboard/loads/add" ||
      pathname === "/dashboard/routes/add" ||
      pathname === "/dashboard/drivers/add" ||
      pathname === "/dashboard/trucks/add" ||
      pathname === "/dashboard/trailers/add"
    if (!isCreationPage) return
    if (!isDesktop || !isCollapsed) return
    if (autoExpandedForPath.current === pathname) return
    autoExpandedForPath.current = pathname
    onCollapseToggle()
  }, [pathname, isDesktop, isCollapsed, onCollapseToggle])

  // Auto-close dropdowns when sidebar collapses (only on desktop)
  useEffect(() => {
    if (shouldShowCollapsed) {
      setDriversOpen(false)
      setVehiclesOpen(false)
      setRoutesOpen(false)
      setLoadsOpen(false)
      setAccountingOpen(false)
      setPayablesOpen(false)
      setMaintenanceOpen(false)
      setReportsOpen(false)
      setCrmOpen(false)
      setSettingsOpen(false)
      setEldOpen(false)
      setComplianceOpen(false)
    }
  }, [shouldShowCollapsed])

  useEffect(() => {
    if (pathname.startsWith("/dashboard/eld")) {
      setEldOpen(true)
    }
    if (pathname.startsWith("/dashboard/reports")) {
      setReportsOpen(true)
    }
  }, [pathname])

  useEffect(() => {
    if (!shell.data) return
    const mappedRole = mapLegacyRole(shell.data.currentUser.role) as EmployeeRole
    setUserRole(mappedRole)
    try {
      localStorage.setItem(LAST_ROLE_KEY, mappedRole)
    } catch {
      //
    }
    const managerRoles: EmployeeRole[] = ["super_admin", "operations_manager"]
    const nextIsManager = managerRoles.includes(mappedRole)
    setIsManager(nextIsManager)
    setManagerCompanyId(nextIsManager ? shell.data.currentUser.company_id : null)
    setAiAssistantPlanBadge(shell.data.aiChatPlan.sidebarLockBadge)
    if (canViewFeature(mappedRole, "eld")) {
      setShowEldConnectHint(shell.data.eld.count === 0)
    } else {
      setShowEldConnectHint(false)
    }
    setIsLoading(false)
  }, [shell.data])

  useEffect(() => {
    if (shell.loading || shell.data) return

    let isMounted = true
    
    async function checkUserRole() {
      try {
        let resolvedRole: string | null = null
        let resolvedCompanyId: string | null = null
        const result = await getCurrentUser()

        if (result?.data?.role) {
          const currentUser = result.data as CurrentUserData
          resolvedRole = currentUser.role || null
          resolvedCompanyId = currentUser.company_id || null
        } else {
          // Fallback for cases where server action transport fails in client runtime.
          // We still resolve role from DB first (not JWT metadata) to keep parity with auth policy.
          const supabase = createBrowserClient()
          const { data: authData } = await supabase.auth.getUser()
          const authUserId = authData?.user?.id

          if (authUserId) {
            const { data: userRow } = await supabase
              .from("users")
              .select("role, company_id")
              .eq("id", authUserId)
              .maybeSingle()

            const userCompanyRow = userRow as { role?: string | null; company_id?: string | null } | null
            resolvedRole = userCompanyRow?.role || null
            resolvedCompanyId = userCompanyRow?.company_id || null
          }
        }

        if (!isMounted) return

        if (resolvedRole) {
          const mappedRole = mapLegacyRole(resolvedRole) as EmployeeRole
          setUserRole(mappedRole)
          try {
            localStorage.setItem(LAST_ROLE_KEY, mappedRole)
          } catch {
            // Ignore storage failures (private mode / quota).
          }

          const managerRoles: EmployeeRole[] = ["super_admin", "operations_manager"]
          const nextIsManager = managerRoles.includes(mappedRole)
          setIsManager(nextIsManager)
          setManagerCompanyId(nextIsManager ? resolvedCompanyId : null)
        } else {
          const cachedRole = typeof window !== "undefined" ? localStorage.getItem(LAST_ROLE_KEY) : null
          if (cachedRole) {
            const mappedCachedRole = mapLegacyRole(cachedRole) as EmployeeRole
            setUserRole(mappedCachedRole)
            const managerRoles: EmployeeRole[] = ["super_admin", "operations_manager"]
            const nextIsManager = managerRoles.includes(mappedCachedRole)
            setIsManager(nextIsManager)
            setManagerCompanyId(null)
          } else {
            setIsManager(false)
            setUserRole(null)
            setManagerCompanyId(null)
          }
        }
      } catch (error) {
        if (!isMounted) return
        console.error('[Sidebar] Role check error:', error)
        const cachedRole = typeof window !== "undefined" ? localStorage.getItem(LAST_ROLE_KEY) : null
        if (cachedRole) {
          const mappedCachedRole = mapLegacyRole(cachedRole) as EmployeeRole
          setUserRole(mappedCachedRole)
          const managerRoles: EmployeeRole[] = ["super_admin", "operations_manager"]
          const nextIsManager = managerRoles.includes(mappedCachedRole)
          setIsManager(nextIsManager)
          setManagerCompanyId(null)
        } else {
          setIsManager(false)
          setUserRole(null)
          setManagerCompanyId(null)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }
    checkUserRole()
    
    return () => {
      isMounted = false
    }
  }, [shell.loading, shell.data])

  useEffect(() => {
    if (shell.data) return
    if (!userRole || !canViewFeature(userRole, "eld")) {
      setShowEldConnectHint(false)
      return
    }
    let active = true
    void getEldConnectionCount().then((r) => {
      if (!active || !r.data) return
      setShowEldConnectHint(r.data.count === 0)
    })
    return () => {
      active = false
    }
  }, [userRole])

  useEffect(() => {
    if (!isManager || !managerCompanyId) {
      setPendingApprovalsCount(0)
      return
    }

    let isActive = true
    const supabase = createBrowserClient()
    const fetchPendingCount = async () => {
      const now = new Date().toISOString()
      const { count } = await supabase
        .from("ai_pending_approvals")
        .select("id", { count: "exact", head: true })
        .eq("company_id", managerCompanyId)
        .is("resolved_at", null)
        .gt("expires_at", now)
      if (isActive) {
        setPendingApprovalsCount(count || 0)
      }
    }

    void fetchPendingCount()
    const timer = window.setInterval(() => {
      void fetchPendingCount()
    }, 60000)

    return () => {
      isActive = false
      window.clearInterval(timer)
    }
  }, [isManager, managerCompanyId])

  return (
    <TooltipProvider delayDuration={200}>
      {/* Overlay for mobile */}
      {isOpen && <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={onToggle} />}

      {/* Sidebar */}
      <aside
        className={`fixed lg:relative h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 z-50 flex flex-col ${
          shouldShowCollapsed ? "w-16" : "w-64"
        } ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Header */}
        <div className={`p-6 border-b border-sidebar-border flex items-center ${shouldShowCollapsed ? "justify-center px-2" : "justify-between"}`}>
          {!shouldShowCollapsed && <Logo size="sm" />}
          {shouldShowCollapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <Truck className="w-5 h-5 text-primary-foreground" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">TruckMates</TooltipContent>
            </Tooltip>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={onCollapseToggle}
              className="hidden lg:flex p-1.5 hover:bg-sidebar-accent rounded transition"
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? (
                <ChevronRight className="w-4 h-4 text-foreground" />
              ) : (
                <ChevronLeft className="w-4 h-4 text-foreground" />
              )}
            </button>
            <button onClick={onToggle} className="lg:hidden p-1 hover:bg-sidebar-accent rounded transition">
              <X className="w-5 h-5 text-foreground" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className={`flex-1 overflow-y-auto py-6 ${shouldShowCollapsed ? "space-y-2 px-2" : "space-y-4 px-4"}`}>
          {userRole === "driver" ? (
            <>
              <NavItem href="/dashboard" icon={BarChart3} label="Dashboard" isCollapsed={shouldShowCollapsed} />
              <NavItem href="/dashboard/ai-assistant" icon={Bot} label="AI Assistant" planBadge={aiAssistantPlanBadge} isCollapsed={shouldShowCollapsed} />
              <NavItem href="/dashboard/loads" icon={Package} label="My load" isCollapsed={shouldShowCollapsed} />
              <NavItem href="/dashboard/eld" icon={Shield} label="ELD / HOS" isCollapsed={shouldShowCollapsed} />
              <NavItem href="/dashboard/dvir" icon={FileCheck} label="DVIR" isCollapsed={shouldShowCollapsed} />
              <NavItem href="/dashboard/documents" icon={FolderOpen} label="Documents" isCollapsed={shouldShowCollapsed} />
              <NavItem href="/dashboard/notifications" icon={Bell} label="Notifications" isCollapsed={shouldShowCollapsed} />
              <NavItem href="/dashboard/settings/account" icon={User} label="My account" isCollapsed={shouldShowCollapsed} />
            </>
          ) : (
            <>
              <NavSectionLabel label="Overview" isCollapsed={shouldShowCollapsed} />
              <NavItem href="/dashboard" icon={BarChart3} label="Dashboard" isCollapsed={shouldShowCollapsed} />
              {userRole && canViewFeature(userRole, "dashboard") && (
                <NavItem href="/dashboard/ai-assistant" icon={Bot} label="AI Assistant" planBadge={aiAssistantPlanBadge} isCollapsed={shouldShowCollapsed} />
              )}

              <NavSectionLabel label="Operations" isCollapsed={shouldShowCollapsed} />

              {userRole && canViewFeature(userRole, "loads") && (
                <DropdownItem 
                  icon={Truck} 
                  label="Loads" 
                  href="/dashboard/loads"
                  isOpen={loadsOpen} 
                  onToggle={() => setLoadsOpen(!loadsOpen)}
                  isCollapsed={shouldShowCollapsed}
                >
                  <NavItem href="/dashboard/loads" label="Load List" isSubitem isCollapsed={shouldShowCollapsed} />
                  {userRole && canCreateFeature(userRole, "loads") && (
                    <NavItem href="/dashboard/loads/add" label="Add Load" isSubitem isCollapsed={shouldShowCollapsed} />
                  )}
                </DropdownItem>
              )}
              {userRole && canViewFeature(userRole, "dispatch") && (
                <NavItem href="/dashboard/dispatches" icon={Radio} label="Dispatch Board" isCollapsed={shouldShowCollapsed} />
              )}
              {userRole && canViewFeature(userRole, "dispatch") && (
                <NavItem
                  href="/dashboard/dispatches/ltl"
                  icon={Package}
                  label="LTL movements"
                  planBadge="Fleet"
                  isCollapsed={shouldShowCollapsed}
                />
              )}
              {userRole && canViewFeature(userRole, "routes") && (
                <DropdownItem 
                  icon={BarChart3} 
                  label="Routes" 
                  href="/dashboard/routes"
                  isOpen={routesOpen} 
                  onToggle={() => setRoutesOpen(!routesOpen)}
                  isCollapsed={shouldShowCollapsed}
                >
                  <NavItem href="/dashboard/routes" label="Route List" isSubitem isCollapsed={shouldShowCollapsed} />
                  {userRole && canCreateFeature(userRole, "routes") && (
                    <>
                      <NavItem href="/dashboard/routes/add" label="Add Route" isSubitem isCollapsed={shouldShowCollapsed} />
                      <NavItem href="/dashboard/routes/optimize" label="Optimize Routes" isSubitem isCollapsed={shouldShowCollapsed} />
                    </>
                  )}
                </DropdownItem>
              )}
              {userRole && canViewFeature(userRole, "drivers") && (
                <DropdownItem 
                  icon={Users} 
                  label="Drivers" 
                  href="/dashboard/drivers"
                  isOpen={driversOpen} 
                  onToggle={() => setDriversOpen(!driversOpen)}
                  isCollapsed={shouldShowCollapsed}
                >
                  <NavItem href="/dashboard/drivers" label="Driver List" isSubitem isCollapsed={shouldShowCollapsed} />
                  {userRole && canCreateFeature(userRole, "drivers") && (
                    <NavItem href="/dashboard/drivers/add" label="Add Driver" isSubitem isCollapsed={shouldShowCollapsed} />
                  )}
                </DropdownItem>
              )}
              {userRole && canViewFeature(userRole, "vehicles") && (
                <DropdownItem
                  icon={Truck}
                  label="Vehicles"
                  href="/dashboard/trucks"
                  isOpen={vehiclesOpen}
                  onToggle={() => setVehiclesOpen(!vehiclesOpen)}
                  isCollapsed={shouldShowCollapsed}
                >
                  <NavItem href="/dashboard/trucks" label="Vehicle List" isSubitem isCollapsed={shouldShowCollapsed} />
                  <NavItem href="/dashboard/trailers" label="Trailer List" isSubitem isCollapsed={shouldShowCollapsed} />
                  {userRole && canCreateFeature(userRole, "vehicles") && (
                    <>
                      <NavItem href="/dashboard/trucks/add" label="Add Vehicle" isSubitem isCollapsed={shouldShowCollapsed} />
                      <NavItem href="/dashboard/trailers/add" label="Add Trailer" isSubitem isCollapsed={shouldShowCollapsed} />
                    </>
                  )}
                </DropdownItem>
              )}
              {userRole && canViewFeature(userRole, "fleet_map") && (
                <NavItem href="/dashboard/fleet-map" icon={MapPin} label="Fleet Map & Zones" isCollapsed={shouldShowCollapsed} />
              )}

              <NavSectionLabel label="Compliance & Finance" isCollapsed={shouldShowCollapsed} />

              {userRole && canViewFeature(userRole, "maintenance") && (
                <NavItem href="/dashboard/maintenance" icon={Wrench} label="Maintenance" isCollapsed={shouldShowCollapsed} />
              )}

              {userRole && canViewFeature(userRole, "eld") && (
                <DropdownItem
                  icon={Shield}
                  label="ELD"
                  href="/dashboard/eld"
                  isOpen={eldOpen}
                  onToggle={() => setEldOpen(!eldOpen)}
                  isCollapsed={shouldShowCollapsed}
                >
                  <NavItem href="/dashboard/eld/connect" icon={PlugZap} label="Connect ELD" connectHint={showEldConnectHint} isSubitem isCollapsed={shouldShowCollapsed} />
                  <NavItem href="/dashboard/eld/devices" label="ELD Devices" isSubitem isCollapsed={shouldShowCollapsed} />
                  <NavItem href="/dashboard/eld" label="ELD overview" isSubitem isCollapsed={shouldShowCollapsed} />
                  <NavItem href="/dashboard/eld/safety" label="Safety Events" planBadge="Pro" isSubitem isCollapsed={shouldShowCollapsed} />
                  <NavItem href="/dashboard/eld/scorecards" label="Safety Scorecards" planBadge="Pro" isSubitem isCollapsed={shouldShowCollapsed} />
                  <NavItem href="/dashboard/eld/geofences" label="Geofences" planBadge="Starter" isSubitem isCollapsed={shouldShowCollapsed} />
                  <NavItem href="/dashboard/eld/geofences/events" label="Geofence Events" planBadge="Starter" isSubitem isCollapsed={shouldShowCollapsed} />
                  <NavItem href="/dashboard/eld/health" label="Vehicle Health" planBadge="Starter" isSubitem isCollapsed={shouldShowCollapsed} />
                </DropdownItem>
              )}

              {userRole && canViewFeature(userRole, "ifta") && (
                <DropdownItem
                  icon={FileCheck}
                  label="Compliance"
                  href="/dashboard/compliance"
                  isOpen={complianceOpen}
                  onToggle={() => setComplianceOpen(!complianceOpen)}
                  isCollapsed={shouldShowCollapsed}
                >
                  <NavItem href="/dashboard/dvir" label="DVIR Reports" isSubitem isCollapsed={shouldShowCollapsed} />
                  <NavItem href="/dashboard/ifta" label="IFTA" isSubitem isCollapsed={shouldShowCollapsed} />
                  <NavItem href="/dashboard/compliance" label="Safety & Compliance" isSubitem isCollapsed={shouldShowCollapsed} />
                  <NavItem href="/dashboard/settings/compliance" label="Compliance settings" isSubitem isCollapsed={shouldShowCollapsed} />
                  <NavItem href="/dashboard/edi" label="EDI" planBadge="Fleet" isSubitem isCollapsed={shouldShowCollapsed} />
                  <NavItem href="/dashboard/hazmat" label="HAZMAT" planBadge="Fleet" isSubitem isCollapsed={shouldShowCollapsed} />
                  <NavItem href="/dashboard/permits" label="Permits" planBadge="Fleet" isSubitem isCollapsed={shouldShowCollapsed} />
                  {canViewFeature(userRole, "accounting") && (
                    <NavItem href="/dashboard/billing/detention-candidates" label="Detention Candidates" planBadge="Pro" isSubitem isCollapsed={shouldShowCollapsed} />
                  )}
                </DropdownItem>
              )}

              {userRole && canViewFeature(userRole, "accounting") && (
                <DropdownItem
                  icon={DollarSign}
                  label="Accounting"
                  href="/dashboard/accounting/invoices"
                  isOpen={accountingOpen}
                  onToggle={() => setAccountingOpen(!accountingOpen)}
                  isCollapsed={shouldShowCollapsed}
                >
                  <NavItem href="/dashboard/accounting/invoices" label="Invoices" isSubitem isCollapsed={shouldShowCollapsed} />
                  <NavItem href="/dashboard/accounting/invoices/auto-generate" label="Auto-generate" isSubitem isCollapsed={shouldShowCollapsed} />
                  <NavItem href="/dashboard/accounting/expenses" label="Expenses" isSubitem isCollapsed={shouldShowCollapsed} />
                  <NavItem href="/dashboard/accounting/settlements" label="Settlements" isSubitem isCollapsed={shouldShowCollapsed} />
                  <NavItem href="/dashboard/accounting/tax-fuel" label="Tax & Fuel" isSubitem isCollapsed={shouldShowCollapsed} />
                  <NavItem href="/dashboard/accounting/tax-fuel/import" label="Fuel card import" isSubitem isCollapsed={shouldShowCollapsed} />
                  <NavItem href="/dashboard/accounting/ifta/tax-rates" label="IFTA tax rates" isSubitem isCollapsed={shouldShowCollapsed} />
                  <NavItem href="/dashboard/settings/pay-rules" label="Pay rules" isSubitem isCollapsed={shouldShowCollapsed} />
                </DropdownItem>
              )}
              {userRole && canViewFeature(userRole, "accounting") && (
                <DropdownItem
                  icon={Receipt}
                  label="Payables"
                  href="/dashboard/payables/vendor-invoices"
                  isOpen={payablesOpen}
                  onToggle={() => setPayablesOpen(!payablesOpen)}
                  isCollapsed={shouldShowCollapsed}
                >
                  <NavItem
                    href="/dashboard/payables/vendor-invoices"
                    label="Vendor Invoices"
                    planBadge="Pro"
                    isSubitem
                    isCollapsed={shouldShowCollapsed}
                  />
                  <NavItem
                    href="/dashboard/payables/reconcile"
                    label="Bank reconciliation"
                    planBadge="Pro"
                    isSubitem
                    isCollapsed={shouldShowCollapsed}
                  />
                  <NavItem href="/dashboard/payables/ap-aging" label="AP Aging" isSubitem isCollapsed={shouldShowCollapsed} />
                </DropdownItem>
              )}

              <NavSectionLabel label="Business & Tools" isCollapsed={shouldShowCollapsed} />
              {userRole && canViewFeature(userRole, "crm") && (
                <DropdownItem
                  icon={Building2}
                  label="CRM"
                  href="/dashboard/crm"
                  isOpen={crmOpen}
                  onToggle={() => setCrmOpen(!crmOpen)}
                  isCollapsed={shouldShowCollapsed}
                >
                  <NavItem href="/dashboard/crm" label="CRM Dashboard" isSubitem isCollapsed={shouldShowCollapsed} />
                  <NavItem href="/dashboard/customers" label="Customers" isSubitem isCollapsed={shouldShowCollapsed} />
                  {userRole && canCreateFeature(userRole, "crm") && (
                    <NavItem href="/dashboard/customers/add" label="Add Customer" isSubitem isCollapsed={shouldShowCollapsed} />
                  )}
                  <NavItem href="/dashboard/vendors" label="Vendors" isSubitem isCollapsed={shouldShowCollapsed} />
                  {userRole && canCreateFeature(userRole, "crm") && (
                    <NavItem href="/dashboard/vendors/add" label="Add Vendor" isSubitem isCollapsed={shouldShowCollapsed} />
                  )}
                </DropdownItem>
              )}
              {userRole && canViewFeature(userRole, "address_book") && (
                <NavItem href="/dashboard/address-book" icon={Contact} label="Address Book" isCollapsed={shouldShowCollapsed} />
              )}
              {userRole && canViewFeature(userRole, "reports") && (
                <DropdownItem
                  icon={BarChart3}
                  label="Reports"
                  href="/dashboard/reports"
                  isOpen={reportsOpen}
                  onToggle={() => setReportsOpen(!reportsOpen)}
                  isCollapsed={shouldShowCollapsed}
                >
                  <NavItem href="/dashboard/reports" label="All reports" isSubitem isCollapsed={shouldShowCollapsed} />
                  <NavItem
                    href="/dashboard/reports/detention"
                    label="Detention Report"
                    planBadge="Pro"
                    isSubitem
                    isCollapsed={shouldShowCollapsed}
                  />
                </DropdownItem>
              )}
              {userRole && canViewFeature(userRole, "documents") && (
                <NavItem href="/dashboard/documents" icon={FolderOpen} label="Documents" isCollapsed={shouldShowCollapsed} />
              )}
              {userRole && canViewFeature(userRole, "alerts") && (
                <NavItem href="/dashboard/notifications" icon={Bell} label="Notifications" isCollapsed={shouldShowCollapsed} />
              )}
              {userRole && canViewFeature(userRole, "bol") && (
                <NavItem href="/dashboard/bols" icon={FileText} label="Bill of Lading" isCollapsed={shouldShowCollapsed} />
              )}

              {userRole && (userRole === "super_admin" || userRole === "operations_manager") && (
                <>
                  <NavSectionLabel label="Administration" isCollapsed={shouldShowCollapsed} />
                  <NavItem href="/dashboard/settings/users" icon={UserCog} label="Users & invites" isCollapsed={shouldShowCollapsed} />
                  <NavItem
                    href="/dashboard/settings/ai-automation"
                    icon={Sparkles}
                    label="AI Automation"
                    badgeCount={pendingApprovalsCount}
                    planBadge="Pro"
                    isCollapsed={shouldShowCollapsed}
                  />
                </>
              )}
            </>
          )}
        </nav>

        {/* Footer */}
        <div className={`border-t border-sidebar-border ${shouldShowCollapsed ? "p-2" : "p-4"} space-y-1`}>
          {userRole && userRole !== "driver" && (
            <NavItem href="/dashboard/settings/account" icon={User} label="My account" isCollapsed={shouldShowCollapsed} />
          )}
          {/* Settings - Super Admin only */}
          {userRole === "super_admin" && (
            <DropdownItem
              icon={Settings}
              label="Settings"
              href="/dashboard/settings"
              isOpen={settingsOpen}
              onToggle={() => setSettingsOpen(!settingsOpen)}
              isCollapsed={shouldShowCollapsed}
            >
              <NavItem href="/dashboard/settings" label="General" isSubitem isCollapsed={shouldShowCollapsed} />
              <NavItem href="/dashboard/settings/users" label="Users" isSubitem isCollapsed={shouldShowCollapsed} />
              <NavItem href="/dashboard/settings/invoice" label="Invoice" isSubitem isCollapsed={shouldShowCollapsed} />
                <NavItem href="/dashboard/settings/billing" label="Billing" isSubitem isCollapsed={shouldShowCollapsed} />
              <NavItem href="/dashboard/settings/factoring" label="Factoring" isSubitem isCollapsed={shouldShowCollapsed} />
                <NavItem href="/dashboard/settings/integration" label="Integration" isSubitem isCollapsed={shouldShowCollapsed} />
                <NavItem href="/dashboard/settings/portal" label="Portal" isSubitem isCollapsed={shouldShowCollapsed} />
              <NavItem href="/dashboard/settings/load" label="Load" isSubitem isCollapsed={shouldShowCollapsed} />
              <NavItem href="/dashboard/settings/dispatch" label="Dispatch" isSubitem isCollapsed={shouldShowCollapsed} />
              <NavItem href="/dashboard/settings/compliance" label="Compliance" isSubitem isCollapsed={shouldShowCollapsed} />
              <NavItem href="/dashboard/settings/business" label="Business" isSubitem isCollapsed={shouldShowCollapsed} />
              <NavItem href="/dashboard/settings/year-end" label="Year-End" isSubitem isCollapsed={shouldShowCollapsed} />
              <NavItem href="/dashboard/settings/alerts" label="Alerts" isSubitem isCollapsed={shouldShowCollapsed} />
              <NavItem href="/dashboard/settings/audit-logs" label="Audit Logs" isSubitem isCollapsed={shouldShowCollapsed} />
              <NavItem href="/dashboard/settings/webhooks" label="Webhooks" isSubitem isCollapsed={shouldShowCollapsed} />
              <NavItem href="/dashboard/settings/multi-terminal" label="Multi-terminal" planBadge="Fleet" isSubitem isCollapsed={shouldShowCollapsed} />
              <NavItem href="/dashboard/settings/api-keys" label="API Keys" planBadge="Fleet" isSubitem isCollapsed={shouldShowCollapsed} />
            </DropdownItem>
          )}
        </div>
      </aside>
    </TooltipProvider>
  )
}

interface NavItemProps {
  href: string
  icon?: LucideIcon
  label: string
  badgeCount?: number
  /** Green + when no ELD connected yet */
  connectHint?: boolean
  /** Optional plan hint (Fleet, Pro, …) for gated features—navigation still works. */
  planBadge?: string | null
  isSubitem?: boolean
  isCollapsed?: boolean
}

function NavSectionLabel({ label, isCollapsed }: { label: string; isCollapsed?: boolean }) {
  if (isCollapsed) {
    return <div className="my-1 h-px bg-sidebar-border/70" />
  }

  return (
    <div className="px-4 pt-2 pb-1">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/55">{label}</p>
    </div>
  )
}

function NavItem({ href, icon: Icon, label, badgeCount, connectHint, planBadge, isSubitem, isCollapsed }: NavItemProps) {
  const badgeLabel = planBadge ? `🔒 ${planBadge}` : ""
  const content = (
    <div
      className={`flex items-center rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition font-medium ${
        isCollapsed 
          ? "justify-center px-2 py-2.5" 
          : `gap-3 px-4 py-2.5 ${isSubitem ? "text-sm" : ""}`
      }`}
      role={isSubitem ? "menuitem" : undefined}
    >
      {Icon && <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />}
      {!isCollapsed && <span className="flex-1 min-w-0">{label}</span>}
      {!isCollapsed && planBadge ? (
        <span className="inline-flex shrink-0 rounded-md border border-amber-400/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-100">
          {badgeLabel}
        </span>
      ) : null}
      {!isCollapsed && connectHint ? (
        <span className="inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[11px] font-semibold text-white">
          +
        </span>
      ) : null}
      {!isCollapsed && typeof badgeCount === "number" && badgeCount > 0 ? (
        <span className="inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-white">
          {badgeCount > 99 ? "99+" : badgeCount}
        </span>
      ) : null}
    </div>
  )

  if (!href || typeof href !== 'string' || href.trim() === '') {
    return <div>{content}</div>
  }

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link href={href} aria-label={`${label}${planBadge ? ` (${planBadge})` : ""}`} prefetch={false}>
            {content}
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right">
          {label}
          {planBadge ? ` — ${planBadge}` : ""}
        </TooltipContent>
      </Tooltip>
    )
  }

  return <Link href={href} aria-label={isSubitem ? undefined : label} prefetch={false}>{content}</Link>
}

interface DropdownItemProps {
  icon: LucideIcon
  label: string
  href: string
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
  isCollapsed?: boolean
}

function DropdownItem({ icon: Icon, label, href, isOpen, onToggle, children, isCollapsed }: DropdownItemProps) {
  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link href={href} prefetch={false}>
            <div className="w-full flex items-center justify-center px-2 py-2.5 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition font-medium">
              <Icon className="w-5 h-5" />
            </div>
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <div>
      <div className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition font-medium">
        <Link
          href={href}
          prefetch={false}
          className="flex items-center gap-3 flex-1 min-w-0"
          aria-label={label}
        >
          <Icon className="w-5 h-5" aria-hidden="true" />
          <span className="truncate">{label}</span>
        </Link>
        <button
          type="button"
          onClick={onToggle}
          className="ml-2 inline-flex items-center justify-center rounded p-1 hover:bg-sidebar-accent/80"
          aria-expanded={isOpen}
          aria-haspopup="true"
          aria-label={`${label} menu`}
        >
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      </div>

      {isOpen && (
        <div className="ml-6 mt-2 space-y-1 border-l border-sidebar-border pl-4" role="menu">
          {children}
        </div>
      )}
    </div>
  )
}
