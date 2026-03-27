import React, { useState } from "react"
import { Alert, Pressable, StyleSheet, Switch, Text, View } from "react-native"
import { useAutoEld } from "../context/AutoEldContext"
import { useAuth } from "../context/AuthContext"
import { useHos } from "../context/HosContext"
import { useUnassignedDriving } from "../context/UnassignedDrivingContext"
import { captureAndQueueLocation, requestLocationPermissions } from "../services/location-tracker"
import { formatMinutes } from "../services/hos-engine"
import { flushQueue } from "../services/sync-queue"
import { colors } from "../theme/tokens"
import type { DutyStatus } from "../types/eld"

const labels: Record<DutyStatus, string> = {
  off_duty: "Off Duty",
  sleeper_berth: "Sleeper Berth",
  driving: "Driving",
  on_duty: "On Duty",
}

export function DriverHomeScreen() {
  const { sessionToken, deviceId, userId, assignedTruckId } = useAuth()
  const { clocks, currentStatus, shortHaulSession, updateStatus } = useHos()
  const { enabled, lastSpeedMph, startMonitoring, stopMonitoring } = useAutoEld()
  const { segments, claimAll } = useUnassignedDriving()
  const [status, setStatus] = useState<DutyStatus>("off_duty")
  const [syncing, setSyncing] = useState(false)

  React.useEffect(() => {
    setStatus(currentStatus)
  }, [currentStatus])

  async function setDutyStatus(next: DutyStatus) {
    await updateStatus(next)
  }

  async function syncNow() {
    if (!sessionToken || !deviceId) return
    setSyncing(true)
    try {
      const allowed = await requestLocationPermissions()
      if (allowed) await captureAndQueueLocation(userId || undefined)
      await flushQueue(sessionToken, deviceId)
      Alert.alert("Sync complete", "ELD data synced successfully.")
    } catch (e) {
      Alert.alert("Sync failed", e instanceof Error ? e.message : "Unknown error")
    } finally {
      setSyncing(false)
    }
  }

  async function toggleMonitoring(value: boolean) {
    try {
      if (value) {
        await startMonitoring()
      } else {
        stopMonitoring()
      }
    } catch (e) {
      Alert.alert("Auto ELD", e instanceof Error ? e.message : "Unable to toggle auto monitoring")
    }
  }

  async function claimSegments() {
    try {
      await claimAll()
      Alert.alert("Segments claimed", "Unassigned driving segments were assigned to your current truck.")
    } catch (e) {
      Alert.alert("Claim failed", e instanceof Error ? e.message : "Unable to claim unassigned segments")
    }
  }

  const pendingSegments = segments.filter((item) => !item.claimed).length

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Driver Dashboard</Text>
      <Text style={styles.muted}>Current duty status</Text>
      <Text style={styles.status}>{labels[status]}</Text>

      <View style={styles.clockRow}>
        <View style={styles.clockCard}>
          <Text style={styles.clockLabel}>Drive</Text>
          <Text style={styles.clockValue}>{formatMinutes(clocks.driveMinutesLeft)}</Text>
        </View>
        <View style={styles.clockCard}>
          <Text style={styles.clockLabel}>Shift</Text>
          <Text style={styles.clockValue}>{formatMinutes(clocks.shiftMinutesLeft)}</Text>
        </View>
        <View style={styles.clockCard}>
          <Text style={styles.clockLabel}>Cycle</Text>
          <Text style={styles.clockValue}>{formatMinutes(clocks.cycleMinutesLeft)}</Text>
        </View>
      </View>
      <View style={styles.clockRow}>
        <View style={styles.clockCard}>
          <Text style={styles.clockLabel}>Break Due In</Text>
          <Text style={styles.clockValue}>{formatMinutes(clocks.breakDueInMinutes)}</Text>
        </View>
        <View style={styles.clockCard}>
          <Text style={styles.clockLabel}>Break Progress</Text>
          <Text style={styles.clockValue}>{formatMinutes(clocks.currentBreakProgressMinutes)}</Text>
        </View>
      </View>
      <View style={styles.complianceCard}>
        <Text style={styles.monitorTitle}>Compliance Signals</Text>
        <Text style={styles.monitorText}>Adverse extension: {clocks.adverseConditionApplied ? "Active (+2h)" : "Inactive"}</Text>
        <Text style={styles.monitorText}>Short-haul: {clocks.shortHaulStatus}</Text>
        <Text style={styles.monitorText}>
          Short-haul session:{" "}
          {shortHaulSession?.startedAt
            ? shortHaulSession.endedAt
              ? shortHaulSession.returnedToTerminal
                ? "Closed - returned"
                : "Closed - no return"
              : "Active"
            : "Not started"}
        </Text>
        <Text style={styles.monitorText}>Split sleeper: {clocks.splitSleeperStatus}</Text>
      </View>

      <View style={styles.monitorCard}>
        <View>
          <Text style={styles.monitorTitle}>Automatic ELD Monitoring</Text>
          <Text style={styles.monitorText}>
            {enabled ? "Enabled" : "Disabled"} {lastSpeedMph !== null ? `• ${lastSpeedMph.toFixed(1)} mph` : ""}
          </Text>
        </View>
        <Switch value={enabled} onValueChange={(value) => void toggleMonitoring(value)} />
      </View>

      <View style={styles.unassignedCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.monitorTitle}>Unassigned Driving</Text>
          <Text style={styles.monitorText}>
            {pendingSegments} pending segment(s) • Truck: {assignedTruckId || "Not set"}
          </Text>
        </View>
        <Pressable
          style={[styles.claimButton, pendingSegments === 0 && styles.claimButtonDisabled]}
          onPress={() => void claimSegments()}
          disabled={pendingSegments === 0}
        >
          <Text style={styles.claimButtonText}>Claim</Text>
        </Pressable>
      </View>

      <View style={styles.grid}>
        {(["off_duty", "sleeper_berth", "driving", "on_duty"] as DutyStatus[]).map((d) => (
          <Pressable
            key={d}
            style={[styles.statusButton, status === d && styles.statusButtonActive]}
            onPress={() => void setDutyStatus(d)}
          >
            <Text style={styles.statusButtonText}>{labels[d]}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.syncButton} onPress={() => void syncNow()} disabled={syncing}>
        <Text style={styles.syncButtonText}>{syncing ? "Syncing..." : "Sync ELD Data"}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20, gap: 12 },
  header: { color: colors.text, fontSize: 24, fontWeight: "700" },
  muted: { color: colors.mutedText },
  status: { color: colors.primary, fontSize: 20, fontWeight: "700" },
  clockRow: { flexDirection: "row", gap: 8 },
  clockCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
  },
  clockLabel: { color: colors.mutedText, fontSize: 12 },
  clockValue: { color: colors.text, fontWeight: "700", marginTop: 4 },
  monitorCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    backgroundColor: colors.surface,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  monitorTitle: { color: colors.text, fontWeight: "700" },
  monitorText: { color: colors.mutedText, marginTop: 3, fontSize: 12 },
  complianceCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    backgroundColor: colors.surface,
  },
  unassignedCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    backgroundColor: colors.surface,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  claimButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  claimButtonDisabled: { opacity: 0.5 },
  claimButtonText: { color: colors.text, fontWeight: "700" },
  grid: { gap: 8 },
  statusButton: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    backgroundColor: colors.surface,
  },
  statusButtonActive: { borderColor: colors.primary },
  statusButtonText: { color: colors.text, fontWeight: "600" },
  syncButton: {
    marginTop: 10,
    backgroundColor: colors.success,
    borderRadius: 10,
    padding: 13,
    alignItems: "center",
  },
  syncButtonText: { color: colors.text, fontWeight: "700" },
})
