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
  DollarSign,
  Wrench,
  FolderOpen,
  Receipt,
  UserCog,
  Shield,
  Upload,
} from "lucide-react"
import Link from "next/link"
import { Logo } from "@/components/logo"
import { getCurrentUser } from "@/app/actions/user"

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
}

export default function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const [driversOpen, setDriversOpen] = useState(false)
  const [vehiclesOpen, setVehiclesOpen] = useState(false)
  const [routesOpen, setRoutesOpen] = useState(false)
  const [loadsOpen, setLoadsOpen] = useState(false)
  const [accountingOpen, setAccountingOpen] = useState(false)
  const [maintenanceOpen, setMaintenanceOpen] = useState(false)
  const [reportsOpen, setReportsOpen] = useState(false)
  const [isManager, setIsManager] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function checkUserRole() {
      try {
        const result = await getCurrentUser()
        if (result.data) {
          setIsManager(result.data.role === "manager")
        } else if (result.error) {
          console.error("Error getting user role:", result.error)
        }
      } catch (error) {
        console.error("Error checking user role:", error)
      } finally {
        setIsLoading(false)
      }
    }
    checkUserRole()
  }, [])

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={onToggle} />}

      {/* Sidebar */}
      <aside
        className={`fixed lg:relative h-screen w-64 bg-sidebar border-r border-sidebar-border transition-transform duration-200 z-50 flex flex-col ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Header */}
        <div className="p-6 border-b border-sidebar-border flex items-center justify-between">
          <Logo size="sm" />
          <button onClick={onToggle} className="lg:hidden p-1 hover:bg-sidebar-accent rounded transition">
            <X className="w-5 h-5 text-foreground" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          <NavItem href="/dashboard" icon={BarChart3} label="Dashboard" />

          {/* Drivers Dropdown */}
          <DropdownItem icon={Users} label="Drivers" isOpen={driversOpen} onToggle={() => setDriversOpen(!driversOpen)}>
            <NavItem href="/dashboard/drivers" label="Driver List" isSubitem />
            <NavItem href="/dashboard/drivers/add" label="Add Driver" isSubitem />
          </DropdownItem>

          {/* Vehicles Dropdown */}
          <DropdownItem
            icon={Truck}
            label="Vehicles"
            isOpen={vehiclesOpen}
            onToggle={() => setVehiclesOpen(!vehiclesOpen)}
          >
            <NavItem href="/dashboard/trucks" label="Vehicle List" isSubitem />
            <NavItem href="/dashboard/trucks/add" label="Add Vehicle" isSubitem />
          </DropdownItem>

          {/* Routes Dropdown */}
          <DropdownItem icon={BarChart3} label="Routes" isOpen={routesOpen} onToggle={() => setRoutesOpen(!routesOpen)}>
            <NavItem href="/dashboard/routes" label="Route List" isSubitem />
            <NavItem href="/dashboard/routes/add" label="Add Route" isSubitem />
          </DropdownItem>

          {/* Loads Dropdown */}
          <DropdownItem icon={Truck} label="Loads" isOpen={loadsOpen} onToggle={() => setLoadsOpen(!loadsOpen)}>
            <NavItem href="/dashboard/loads" label="Load List" isSubitem />
            <NavItem href="/dashboard/loads/add" label="Add Load" isSubitem />
          </DropdownItem>

          {/* Accounting Dropdown */}
          <DropdownItem
            icon={DollarSign}
            label="Accounting"
            isOpen={accountingOpen}
            onToggle={() => setAccountingOpen(!accountingOpen)}
          >
            <NavItem href="/dashboard/accounting/invoices" label="Invoices" isSubitem />
            <NavItem href="/dashboard/accounting/expenses" label="Expenses" isSubitem />
            <NavItem href="/dashboard/accounting/settlements" label="Settlements" isSubitem />
          </DropdownItem>

          {/* Maintenance Dropdown */}
          <DropdownItem
            icon={Wrench}
            label="Maintenance"
            isOpen={maintenanceOpen}
            onToggle={() => setMaintenanceOpen(!maintenanceOpen)}
          >
            <NavItem href="/dashboard/maintenance" label="Schedule" isSubitem />
            <NavItem href="/dashboard/maintenance/add" label="Add Service" isSubitem />
          </DropdownItem>

          {/* ELD Service */}
          <NavItem href="/dashboard/eld" icon={Shield} label="ELD Service" />

          {/* IFTA & Reports */}
          <NavItem href="/dashboard/ifta" icon={Receipt} label="IFTA Reports" />

          {/* Reports Dropdown */}
          <DropdownItem
            icon={FileText}
            label="Reports"
            isOpen={reportsOpen}
            onToggle={() => setReportsOpen(!reportsOpen)}
          >
            <NavItem href="/dashboard/reports/profit-loss" label="Profit & Loss" isSubitem />
            <NavItem href="/dashboard/reports/revenue" label="Revenue" isSubitem />
            <NavItem href="/dashboard/reports/driver-payments" label="Driver Payments" isSubitem />
          </DropdownItem>

          {/* Documents */}
          <NavItem href="/dashboard/documents" icon={FolderOpen} label="Documents" />

          {/* Upload & Analyze Document */}
          <NavItem href="/dashboard/upload-document" icon={Upload} label="Upload Document" />

          {/* Employees - Managers Only */}
          {isManager && (
            <NavItem href="/dashboard/employees" icon={UserCog} label="Employees" />
          )}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-sidebar-border">
          <NavItem href="/dashboard/settings" icon={Settings} label="Settings" />
        </div>
      </aside>
    </>
  )
}

interface NavItemProps {
  href: string
  icon?: any
  label: string
  isSubitem?: boolean
}

function NavItem({ href, icon: Icon, label, isSubitem }: NavItemProps) {
  return (
    <Link href={href}>
      <div
        className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition font-medium ${
          isSubitem ? "text-sm" : ""
        }`}
      >
        {Icon && <Icon className="w-5 h-5" />}
        <span>{label}</span>
      </div>
    </Link>
  )
}

interface DropdownItemProps {
  icon: any
  label: string
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}

function DropdownItem({ icon: Icon, label, isOpen, onToggle, children }: DropdownItemProps) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition font-medium"
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5" />
          <span>{label}</span>
        </div>
        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && <div className="ml-6 mt-2 space-y-1 border-l border-sidebar-border pl-4">{children}</div>}
    </div>
  )
}
