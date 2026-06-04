"use client"

import { Building2, Radio, Truck, Shield, DollarSign, User } from "lucide-react"
import Link from "next/link"
import { Logo } from "@/components/logo"
import { useRouter } from "next/navigation"
import { ROLES, type EmployeeRole } from "@/lib/roles"
import { DotBg } from "@/components/marketing/marketing-ui"

export default function RegisterPage() {
  const router = useRouter()

  const roleIcons = {
    super_admin: Building2,
    operations_manager: Radio,
    dispatcher: Truck,
    safety_compliance: Shield,
    financial_controller: DollarSign,
    driver: User,
  }

  const handleRoleSelect = (role: EmployeeRole) => {
    const roleInfo = ROLES[role]
    if (roleInfo.requiresCompany && role === "super_admin") {
      router.push(`/register/super-admin?role=${role}`)
    } else {
      router.push(`/register/employee?role=${role}`)
    }
  }

  return (
    <div className="relative min-h-screen px-4 pb-16" style={{ background: "var(--w-bg)" }}>
      <DotBg />
      <Link
        href="/"
        className="absolute top-6 left-6 z-10 text-sm text-[var(--w-blue)]"
        style={{ fontFamily: "var(--font-jakarta), sans-serif" }}
      >
        ← Home
      </Link>

      <div className="relative mx-auto max-w-[920px] pt-[100px]">
        <div className="flex justify-center">
          <Logo size="md" />
        </div>

        <div className="mt-10 text-center">
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--w-blue)]"
            style={{ fontFamily: "var(--font-bricolage), sans-serif" }}
          >
            Get started
          </span>
          <h1
            className="mt-3 text-[clamp(32px,4vw,52px)] leading-tight font-extrabold text-[var(--w-text)]"
            style={{ fontFamily: "var(--font-bricolage), sans-serif" }}
          >
            Choose your role.
          </h1>
          <p
            className="mx-auto mt-3 mb-10 max-w-lg text-base text-[var(--w-text-2)]"
            style={{ fontFamily: "var(--font-jakarta), sans-serif" }}
          >
            Select your role to get started. This determines your access level.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.values(ROLES).map((roleInfo) => {
            const Icon = roleIcons[roleInfo.id]
            return (
              <button
                key={roleInfo.id}
                type="button"
                onClick={() => handleRoleSelect(roleInfo.id)}
                className="group w-full rounded-[14px] border p-7 text-left transition-all duration-150 ease-out hover:-translate-y-0.5 hover:border-[var(--w-blue-border)] hover:shadow-[0_8px_24px_rgba(59,130,246,0.08)]"
                style={{
                  background: "var(--w-card)",
                  borderColor: "var(--w-border)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--w-card-hover)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--w-card)"
                }}
              >
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-[10px] border"
                  style={{
                    background: "var(--w-blue-dim)",
                    borderColor: "rgba(59,130,246,0.15)",
                  }}
                >
                  <Icon className="h-5 w-5 text-[var(--w-blue)]" />
                </div>
                <h3
                  className="mt-4 text-[19px] font-bold text-[var(--w-text)]"
                  style={{ fontFamily: "var(--font-bricolage), sans-serif" }}
                >
                  {roleInfo.name}
                </h3>
                <p
                  className="mt-1.5 text-sm leading-[1.55] text-[var(--w-text-2)]"
                  style={{ fontFamily: "var(--font-jakarta), sans-serif" }}
                >
                  {roleInfo.description}
                </p>
                <p
                  className="mt-4 text-[13px] text-[var(--w-blue)] opacity-0 transition-opacity group-hover:opacity-100"
                  style={{ fontFamily: "var(--font-jakarta), sans-serif" }}
                >
                  Get started →
                </p>
              </button>
            )
          })}
        </div>

        <p
          className="mt-10 text-center text-sm text-[var(--w-text-2)]"
          style={{ fontFamily: "var(--font-jakarta), sans-serif" }}
        >
          Already have an account?{" "}
          <Link href="/login" className="text-[var(--w-blue)] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
