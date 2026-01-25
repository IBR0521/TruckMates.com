"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getCurrentUser } from "@/app/actions/user"
import { mapLegacyRole, type EmployeeRole } from "@/lib/roles"
import { canViewFeature, type FeatureCategory } from "@/lib/feature-permissions"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Shield, ArrowLeft } from "lucide-react"
import Link from "next/link"

interface AccessGuardProps {
  children: React.ReactNode
  requiredFeature: FeatureCategory
  fallback?: React.ReactNode
}

export function AccessGuard({ children, requiredFeature, fallback }: AccessGuardProps) {
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [userRole, setUserRole] = useState<EmployeeRole | null>(null)
  const router = useRouter()

  useEffect(() => {
    async function checkAccess() {
      try {
        const result = await getCurrentUser()
        if (result?.data) {
          const employeeRole = (result.data as any).employee_role || result.data.role
          const mappedRole = mapLegacyRole(employeeRole) as EmployeeRole
          setUserRole(mappedRole)
          const access = canViewFeature(mappedRole, requiredFeature)
          setHasAccess(access)
        } else {
          setHasAccess(false)
        }
      } catch (error) {
        console.error("Access check error:", error)
        setHasAccess(false)
      } finally {
        setIsLoading(false)
      }
    }
    checkAccess()
  }, [requiredFeature])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Checking access...</p>
        </div>
      </div>
    )
  }

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>
    }
    return <AccessDenied feature={requiredFeature} userRole={userRole} />
  }

  return <>{children}</>
}

interface AccessDeniedProps {
  feature: FeatureCategory
  userRole: EmployeeRole | null
}

function AccessDenied({ feature, userRole }: AccessDeniedProps) {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-4">
      <Card className="max-w-md w-full p-8 text-center">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Shield className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Access Denied</h2>
        <p className="text-muted-foreground mb-4">
          You don't have permission to access this feature.
        </p>
        <p className="text-sm text-muted-foreground mb-6">
          Required access: <span className="font-medium">{feature}</span>
          {userRole && (
            <>
              <br />
              Your role: <span className="font-medium">{userRole}</span>
            </>
          )}
        </p>
        <div className="flex gap-3 justify-center">
          <Button asChild variant="outline">
            <Link href="/dashboard">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  )
}


