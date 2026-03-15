"use client"

import Link from "next/link"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Building2 } from "lucide-react"
import { cn } from "@/lib/utils"

export type CRMCurrentPage =
  | "dashboard"
  | "customers"
  | "vendors"
  | "customer-detail"
  | "vendor-detail"

interface CRMSectionHeaderProps {
  /** Which CRM page is active (for breadcrumb) */
  currentPage: CRMCurrentPage
  /** For customer-detail or vendor-detail, the entity name (e.g. "Acme Corp") */
  entityName?: string
  /** Optional: extra class for the wrapper */
  className?: string
}

export function CRMSectionHeader({
  currentPage,
  entityName,
  className,
}: CRMSectionHeaderProps) {
  return (
    <div className={cn(className)}>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/dashboard/crm" className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4" />
                CRM
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          {currentPage === "dashboard" && (
            <BreadcrumbItem>
              <BreadcrumbPage>Dashboard</BreadcrumbPage>
            </BreadcrumbItem>
          )}
          {currentPage === "customers" && (
            <BreadcrumbItem>
              <BreadcrumbPage>Customers</BreadcrumbPage>
            </BreadcrumbItem>
          )}
          {currentPage === "vendors" && (
            <BreadcrumbItem>
              <BreadcrumbPage>Vendors</BreadcrumbPage>
            </BreadcrumbItem>
          )}
          {(currentPage === "customer-detail" || currentPage === "vendor-detail") && (
            <>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href={currentPage === "customer-detail" ? "/dashboard/customers" : "/dashboard/vendors"}>
                    {currentPage === "customer-detail" ? "Customers" : "Vendors"}
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{entityName ?? "Detail"}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  )
}
