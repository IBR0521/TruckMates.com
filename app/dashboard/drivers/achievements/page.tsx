"use client"

import { useState, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Trophy,
  Medal,
  Award,
  Star,
  Shield,
  Clock,
  TrendingUp,
  Target,
  CheckCircle2,
} from "lucide-react"
import { getDriverBadges, getDriverPerformanceScore } from "@/app/actions/gamification"
import { getDrivers } from "@/app/actions/drivers"
import { getPlanFeatureAccessStatus } from "@/app/actions/plan-feature-access"
import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { format } from "date-fns"
import { UpgradeModal } from "@/components/billing/upgrade-modal"

export default function DriverAchievementsPage() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (pathname === "/dashboard/drivers/achievements") {
      router.replace("/dashboard/drivers?tab=performance&performanceTab=achievements")
    }
  }, [pathname, router])

  const [badges, setBadges] = useState<any[]>([])
  const [performance, setPerformance] = useState<any>(null)
  const [drivers, setDrivers] = useState<any[]>([])
  const [scorecardsAllowed, setScorecardsAllowed] = useState(true)
  const [planName, setPlanName] = useState("starter")
  const [selectedDriverId, setSelectedDriverId] = useState<string>("all")
  const [isLoading, setIsLoading] = useState(true)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  useEffect(() => {
    loadDrivers()
  }, [])

  useEffect(() => {
    if (selectedDriverId !== "all") {
      loadAchievements()
    } else {
      setBadges([])
      setPerformance(null)
    }
  }, [selectedDriverId])

  async function loadDrivers() {
    const access = await getPlanFeatureAccessStatus("driver_scorecards")
    if (access.error) {
      toast.error(access.error)
      setIsLoading(false)
      return
    }
    const allowed = !!access.data?.allowed
    setScorecardsAllowed(allowed)
    setPlanName(String(access.data?.plan_name || "starter"))
    if (!allowed) {
      setDrivers([])
      setBadges([])
      setPerformance(null)
      setSelectedDriverId("all")
      setIsLoading(false)
      return
    }

    const result = await getDrivers()
    if (result.data) {
      setDrivers(result.data)
      // Auto-select first driver if available
      if (result.data.length > 0 && selectedDriverId === "all") {
        setSelectedDriverId(result.data[0].id)
      }
    }
  }

  async function loadAchievements() {
    if (selectedDriverId === "all") return
    if (!scorecardsAllowed) return

    setIsLoading(true)
    try {
      const [badgesResult, performanceResult] = await Promise.all([
        getDriverBadges(selectedDriverId),
        getDriverPerformanceScore(selectedDriverId, "monthly"),
      ])

      if (badgesResult.error) {
        toast.error(badgesResult.error)
      } else {
        setBadges(badgesResult.data || [])
      }

      if (performanceResult.error) {
        // Performance might not exist yet, that's okay
        setPerformance(null)
      } else {
        setPerformance(performanceResult.data)
      }
    } catch (error: unknown) {
      toast.error("Failed to load achievements")
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  function getBadgeIcon(badgeType: string) {
    switch (badgeType) {
      case "zero_violations_30":
        return <Shield className="w-8 h-8 text-green-500" />
      case "on_time_champion":
        return <Clock className="w-8 h-8 text-blue-500" />
      case "safety_star":
        return <Star className="w-8 h-8 text-yellow-500" />
      default:
        return <Award className="w-8 h-8 text-primary" />
    }
  }

  function getBadgeColor(badgeType: string) {
    switch (badgeType) {
      case "zero_violations_30":
        return "bg-green-500/10 border-green-500/20 text-green-500"
      case "on_time_champion":
        return "bg-blue-500/10 border-blue-500/20 text-blue-500"
      case "safety_star":
        return "bg-yellow-500/10 border-yellow-500/20 text-yellow-500"
      default:
        return "bg-primary/10 border-primary/20 text-primary"
    }
  }

  const selectedDriver = drivers.find((d) => d.id === selectedDriverId)

  return (
    <div className="w-full bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Driver Achievements</h1>
            <p className="text-muted-foreground mt-2">
              View badges, achievements, and performance scores for drivers
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {!scorecardsAllowed && (
            <Card className="p-4 border-amber-500/40 bg-amber-500/5">
              <p className="text-sm text-amber-400">
                Driver scorecards are available on Fleet and Enterprise plans. Your current plan is{" "}
                <span className="font-semibold capitalize">{planName}</span>.
              </p>
              <Button className="mt-3" size="sm" onClick={() => setShowUpgradeModal(true)}>
                Upgrade now
              </Button>
            </Card>
          )}
          {/* Driver Selector */}
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium">Select Driver:</label>
              <Select value={selectedDriverId} onValueChange={setSelectedDriverId} disabled={!scorecardsAllowed}>
                <SelectTrigger className="w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Drivers</SelectItem>
                  {drivers.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Card>

          {selectedDriverId === "all" ? (
            <Card className="p-12 text-center">
              <Trophy className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">Select a driver to view their achievements</p>
            </Card>
          ) : (
            <>
              {/* Performance Score Card */}
              {performance && (
                <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-2xl font-bold text-foreground">
                        {selectedDriver?.name || "Driver"}'s Performance
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Monthly performance score
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-4xl font-bold text-primary">
                        {performance.overall_score?.toFixed(1) || 0}
                      </div>
                      <p className="text-sm text-muted-foreground">Overall Score</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-card rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="w-5 h-5 text-green-500" />
                        <span className="text-sm text-muted-foreground">Safety Score</span>
                      </div>
                      <div className="text-2xl font-bold text-foreground">
                        {performance.safety_score?.toFixed(1) || 0}
                      </div>
                    </div>

                    <div className="p-4 bg-card rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="w-5 h-5 text-blue-500" />
                        <span className="text-sm text-muted-foreground">Compliance Score</span>
                      </div>
                      <div className="text-2xl font-bold text-foreground">
                        {performance.compliance_score?.toFixed(1) || 0}
                      </div>
                    </div>

                    <div className="p-4 bg-card rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-5 h-5 text-purple-500" />
                        <span className="text-sm text-muted-foreground">Efficiency Score</span>
                      </div>
                      <div className="text-2xl font-bold text-foreground">
                        {performance.efficiency_score?.toFixed(1) || 0}
                      </div>
                    </div>
                  </div>

                  {performance.rank && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-yellow-500" />
                        <span className="text-sm text-muted-foreground">
                          Ranked #{performance.rank} in company leaderboard
                        </span>
                      </div>
                    </div>
                  )}
                </Card>
              )}

              {/* Badges Grid */}
              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-foreground">Badges & Achievements</h2>
                  <Badge variant="outline">{badges.length} badges earned</Badge>
                </div>

                {isLoading ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Loading achievements...</p>
                  </div>
                ) : badges.length === 0 ? (
                  <div className="text-center py-12">
                    <Award className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <p className="text-muted-foreground">No badges earned yet</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Keep up the great work! Badges are awarded for excellent performance.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {badges.map((badge) => (
                      <Card
                        key={badge.id}
                        className={`p-6 border-2 ${getBadgeColor(badge.badge_type)}`}
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0">
                            {getBadgeIcon(badge.badge_type)}
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-foreground mb-1">
                              {badge.badge_name}
                            </h3>
                            {badge.badge_description && (
                              <p className="text-sm text-muted-foreground mb-2">
                                {badge.badge_description}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              Earned: {format(new Date(badge.earned_date), "MMM d, yyyy")}
                            </p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </Card>

              {/* Performance Metrics */}
              {performance && (
                <Card className="p-6">
                  <h2 className="text-2xl font-bold text-foreground mb-6">Performance Metrics</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Total Loads</p>
                      <p className="text-2xl font-bold text-foreground">
                        {performance.total_loads || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">On-Time Rate</p>
                      <p className="text-2xl font-bold text-foreground">
                        {performance.on_time_rate?.toFixed(1) || 0}%
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Total Miles</p>
                      <p className="text-2xl font-bold text-foreground">
                        {performance.total_miles?.toLocaleString() || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">HOS Violations</p>
                      <p className="text-2xl font-bold text-foreground">
                        {performance.hos_violations || 0}
                      </p>
                    </div>
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
      <UpgradeModal open={showUpgradeModal} onOpenChange={setShowUpgradeModal} feature="driver_scorecards" />
    </div>
  )
}

