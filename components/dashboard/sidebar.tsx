"use client"

import type React from "react"

import { useState, useEffect } from "react"
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
  Calendar,
  MessageSquare,
  Sparkles,
} from "lucide-react"
import Link from "next/link"
import { Logo } from "@/components/logo"
import { getCurrentUser } from "@/app/actions/user"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
  isCollapsed: boolean
  onCollapseToggle: () => void
}

export default function Sidebar({ isOpen, onToggle, isCollapsed, onCollapseToggle }: SidebarProps) {
  const [driversOpen, setDriversOpen] = useState(false)
  const [vehiclesOpen, setVehiclesOpen] = useState(false)
  const [routesOpen, setRoutesOpen] = useState(false)
  const [loadsOpen, setLoadsOpen] = useState(false)
  const [accountingOpen, setAccountingOpen] = useState(false)
  const [maintenanceOpen, setMaintenanceOpen] = useState(false)
  const [reportsOpen, setReportsOpen] = useState(false)
  const [crmOpen, setCrmOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [dvirOpen, setDvirOpen] = useState(false)
  const [isManager, setIsManager] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isDesktop, setIsDesktop] = useState(true)
  const [mounted, setMounted] = useState(false)

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

  // Auto-close dropdowns when sidebar collapses (only on desktop)
  useEffect(() => {
    if (shouldShowCollapsed) {
      setDriversOpen(false)
      setVehiclesOpen(false)
      setRoutesOpen(false)
      setLoadsOpen(false)
      setAccountingOpen(false)
      setMaintenanceOpen(false)
      setReportsOpen(false)
      setCrmOpen(false)
      setSettingsOpen(false)
      setDvirOpen(false)
    }
  }, [shouldShowCollapsed])

  useEffect(() => {
    let isMounted = true
    
    async function checkUserRole() {
      try {
        const result = await getCurrentUser()
        
        if (!isMounted) return
        
        if (result?.data) {
          // Simple check: manager or owner = manager, everything else = user
          const role = result.data.role
          setIsManager(role === "manager" || role === "owner")
        } else {
          setIsManager(false)
        }
      } catch (error) {
        if (!isMounted) return
        console.error('[Sidebar] Role check error:', error)
        setIsManager(false)
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
  }, [])

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
        <nav className={`flex-1 py-6 space-y-2 overflow-y-auto ${shouldShowCollapsed ? "px-2" : "px-4"}`}>
          {/* Dashboard is always visible */}
          <NavItem href="/dashboard" icon={BarChart3} label="Dashboard" isCollapsed={shouldShowCollapsed} />

          {/* Drivers Dropdown */}
          <DropdownItem 
            icon={Users} 
            label="Drivers" 
            href="/dashboard/drivers"
            isOpen={driversOpen} 
            onToggle={() => setDriversOpen(!driversOpen)}
            isCollapsed={shouldShowCollapsed}
          >
            <NavItem href="/dashboard/drivers" label="Driver List" isSubitem isCollapsed={shouldShowCollapsed} />
            {isManager && (
              <NavItem href="/dashboard/drivers/add" label="Add Driver" isSubitem isCollapsed={shouldShowCollapsed} />
            )}
          </DropdownItem>

          {/* Vehicles Dropdown */}
          <DropdownItem
            icon={Truck}
            label="Vehicles"
            href="/dashboard/trucks"
            isOpen={vehiclesOpen}
            onToggle={() => setVehiclesOpen(!vehiclesOpen)}
            isCollapsed={shouldShowCollapsed}
          >
            <NavItem href="/dashboard/trucks" label="Vehicle List" isSubitem isCollapsed={shouldShowCollapsed} />
            {isManager && (
              <NavItem href="/dashboard/trucks/add" label="Add Vehicle" isSubitem isCollapsed={shouldShowCollapsed} />
            )}
          </DropdownItem>

          {/* Routes Dropdown */}
          <DropdownItem 
            icon={BarChart3} 
            label="Routes" 
            href="/dashboard/routes"
            isOpen={routesOpen} 
            onToggle={() => setRoutesOpen(!routesOpen)}
            isCollapsed={shouldShowCollapsed}
          >
            <NavItem href="/dashboard/routes" label="Route List" isSubitem isCollapsed={shouldShowCollapsed} />
            {isManager && (
              <>
                <NavItem href="/dashboard/routes/add" label="Add Route" isSubitem isCollapsed={shouldShowCollapsed} />
                <NavItem href="/dashboard/routes/optimize" label="Optimize Routes" isSubitem isCollapsed={shouldShowCollapsed} />
              </>
            )}
          </DropdownItem>

          {/* Loads Dropdown */}
          <DropdownItem 
            icon={Truck} 
            label="Loads" 
            href="/dashboard/loads"
            isOpen={loadsOpen} 
            onToggle={() => setLoadsOpen(!loadsOpen)}
            isCollapsed={shouldShowCollapsed}
          >
            <NavItem href="/dashboard/loads" label="Load List" isSubitem isCollapsed={shouldShowCollapsed} />
            <NavItem href="/dashboard/loads/external" label="External Loads" isSubitem isCollapsed={shouldShowCollapsed} />
            {isManager && (
              <NavItem href="/dashboard/loads/add" label="Add Load" isSubitem isCollapsed={shouldShowCollapsed} />
            )}
          </DropdownItem>

          {/* Dispatch Board */}
          <NavItem href="/dashboard/dispatches" icon={Radio} label="Dispatch Board" isCollapsed={shouldShowCollapsed} />

          {/* Fleet Map & Geofencing */}
          <NavItem href="/dashboard/fleet-map" icon={MapPin} label="Fleet Map & Zones" isCollapsed={shouldShowCollapsed} />

          {/* Address Book */}
          <NavItem href="/dashboard/address-book" icon={Contact} label="Address Book" isCollapsed={shouldShowCollapsed} />

          {/* CRM Dropdown */}
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
            {isManager && (
              <NavItem href="/dashboard/customers/add" label="Add Customer" isSubitem isCollapsed={shouldShowCollapsed} />
            )}
            <NavItem href="/dashboard/vendors" label="Vendors" isSubitem isCollapsed={shouldShowCollapsed} />
            {isManager && (
              <NavItem href="/dashboard/vendors/add" label="Add Vendor" isSubitem isCollapsed={shouldShowCollapsed} />
            )}
          </DropdownItem>

          {/* Accounting Dropdown */}
          <DropdownItem
            icon={DollarSign}
            label="Accounting"
            href="/dashboard/accounting/invoices"
            isOpen={accountingOpen}
            onToggle={() => setAccountingOpen(!accountingOpen)}
            isCollapsed={shouldShowCollapsed}
          >
            <NavItem href="/dashboard/accounting/invoices" label="Invoices" isSubitem isCollapsed={shouldShowCollapsed} />
            <NavItem href="/dashboard/accounting/expenses" label="Expenses" isSubitem isCollapsed={shouldShowCollapsed} />
            <NavItem href="/dashboard/accounting/settlements" label="Settlements" isSubitem isCollapsed={shouldShowCollapsed} />
            <NavItem href="/dashboard/accounting/tax-fuel" label="Tax & Fuel" isSubitem isCollapsed={shouldShowCollapsed} />
            <NavItem href="/dashboard/fuel-analytics" label="Fuel Analytics" isSubitem isCollapsed={shouldShowCollapsed} />
          </DropdownItem>

          {/* Maintenance Dropdown */}
          <DropdownItem
            icon={Wrench}
            label="Maintenance"
            href="/dashboard/maintenance"
            isOpen={maintenanceOpen}
            onToggle={() => setMaintenanceOpen(!maintenanceOpen)}
            isCollapsed={shouldShowCollapsed}
          >
            <NavItem href="/dashboard/maintenance" label="Schedule" isSubitem isCollapsed={shouldShowCollapsed} />
            {isManager && (
              <NavItem href="/dashboard/maintenance/add" label="Add Service" isSubitem isCollapsed={shouldShowCollapsed} />
            )}
            <NavItem href="/dashboard/maintenance/work-orders" label="Work Orders" isSubitem isCollapsed={shouldShowCollapsed} />
            <NavItem href="/dashboard/maintenance/fault-code-rules" label="Fault Code Rules" isSubitem isCollapsed={shouldShowCollapsed} />
          </DropdownItem>

          {/* DVIR Dropdown */}
          <DropdownItem
            icon={FileCheck}
            label="DVIR"
            href="/dashboard/dvir"
            isOpen={dvirOpen}
            onToggle={() => setDvirOpen(!dvirOpen)}
            isCollapsed={shouldShowCollapsed}
          >
            <NavItem href="/dashboard/dvir" label="DVIR Reports" isSubitem isCollapsed={shouldShowCollapsed} />
            <NavItem href="/dashboard/dvir/audit" label="Audit Reports" isSubitem isCollapsed={shouldShowCollapsed} />
          </DropdownItem>

          {/* ELD Service */}
          <NavItem href="/dashboard/eld" icon={Shield} label="ELD Service" isCollapsed={shouldShowCollapsed} />

          {/* IFTA & Reports */}
          <NavItem href="/dashboard/ifta" icon={Receipt} label="IFTA Reports" isCollapsed={shouldShowCollapsed} />

          {/* Reports Dropdown */}
          <DropdownItem 
            icon={BarChart3} 
            label="Reports" 
            href="/dashboard/reports/analytics"
            isOpen={reportsOpen} 
            onToggle={() => setReportsOpen(!reportsOpen)}
            isCollapsed={shouldShowCollapsed}
          >
            <NavItem href="/dashboard/reports/analytics" label="Analytics" isSubitem isCollapsed={shouldShowCollapsed} />
            <NavItem href="/dashboard/reports/revenue" label="Revenue" isSubitem isCollapsed={shouldShowCollapsed} />
            <NavItem href="/dashboard/reports/profit-loss" label="Profit & Loss" isSubitem isCollapsed={shouldShowCollapsed} />
            <NavItem href="/dashboard/reports/driver-payments" label="Driver Payments" isSubitem isCollapsed={shouldShowCollapsed} />
          </DropdownItem>

          {/* Documents */}
          <NavItem href="/dashboard/documents" icon={FolderOpen} label="Documents" isCollapsed={shouldShowCollapsed} />

          {/* Alerts */}
          <NavItem href="/dashboard/alerts" icon={Bell} label="Alerts" isCollapsed={shouldShowCollapsed} />

          {/* Reminders */}
          <NavItem href="/dashboard/reminders" icon={Calendar} label="Reminders" isCollapsed={shouldShowCollapsed} />

          {/* BOLs (Bill of Lading) */}
          <NavItem href="/dashboard/bols" icon={FileText} label="Bill of Lading" isCollapsed={shouldShowCollapsed} />


          {/* Employees - Managers only */}
          {isManager && (
            <NavItem href="/dashboard/employees" icon={UserCog} label="Employees" isCollapsed={shouldShowCollapsed} />
          )}

          {/* Marketplace */}
          <NavItem href="/dashboard/marketplace" icon={Store} label="Marketplace" isCollapsed={shouldShowCollapsed} />

        </nav>

        {/* Footer */}
        <div className={`border-t border-sidebar-border ${shouldShowCollapsed ? "p-2" : "p-4"}`}>
          {/* Settings Dropdown */}
          <DropdownItem
            icon={Settings}
            label="Settings"
            href="/dashboard/settings"
            isOpen={settingsOpen}
            onToggle={() => setSettingsOpen(!settingsOpen)}
            isCollapsed={shouldShowCollapsed}
          >
            <NavItem href="/dashboard/settings" label="General" isSubitem isCollapsed={shouldShowCollapsed} />
            <NavItem href="/dashboard/settings/invoice" label="Invoice" isSubitem isCollapsed={shouldShowCollapsed} />
            <NavItem href="/dashboard/settings/load" label="Load" isSubitem isCollapsed={shouldShowCollapsed} />
            <NavItem href="/dashboard/settings/dispatch" label="Dispatch" isSubitem isCollapsed={shouldShowCollapsed} />
            <NavItem href="/dashboard/settings/business" label="Business" isSubitem isCollapsed={shouldShowCollapsed} />
            <NavItem href="/dashboard/settings/alerts" label="Alerts" isSubitem isCollapsed={shouldShowCollapsed} />
            <NavItem href="/dashboard/settings/webhooks" label="Webhooks" isSubitem isCollapsed={shouldShowCollapsed} />
          </DropdownItem>
        </div>
      </aside>
    </TooltipProvider>
  )
}

interface NavItemProps {
  href: string
  icon?: any
  label: string
  isSubitem?: boolean
  isCollapsed?: boolean
}

function NavItem({ href, icon: Icon, label, isSubitem, isCollapsed }: NavItemProps) {
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
      {!isCollapsed && <span>{label}</span>}
    </div>
  )

  if (!href || typeof href !== 'string' || href.trim() === '') {
    return <div>{content}</div>
  }

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link href={href} aria-label={label}>{content}</Link>
        </TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    )
  }

  return <Link href={href} aria-label={isSubitem ? undefined : label}>{content}</Link>
}

interface DropdownItemProps {
  icon: any
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
          <Link href={href}>
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
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition font-medium"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={`${label} menu`}
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5" aria-hidden="true" />
          <span>{label}</span>
        </div>
        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="ml-6 mt-2 space-y-1 border-l border-sidebar-border pl-4" role="menu">
          {children}
        </div>
      )}
    </div>
  )
}
