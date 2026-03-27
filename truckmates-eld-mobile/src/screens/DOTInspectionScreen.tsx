import React, { useMemo, useState } from "react"
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native"
import { useAuth } from "../context/AuthContext"
import { useHos } from "../context/HosContext"
import { useUnassignedDriving } from "../context/UnassignedDrivingContext"
import { useEvents } from "../context/EventContext"
import { colors } from "../theme/tokens"
import type { DriverEvent } from "../types/events"

function pastDays(count: number): string[] {
  const days: string[] = []
  const d = new Date()
  for (let i = 0; i < count; i += 1) {
    const day = new Date(d)
    day.setDate(d.getDate() - i)
    days.push(day.toISOString().slice(0, 10))
  }
  return days
}

type MalfunctionResolutionItem = {
  event_id: string
  event_time: string
  title: string
  severity: DriverEvent["severity"]
  status: "active" | "resolved"
  resolved_at?: string
  root_cause: string
  corrective_action: string
  proof_metadata: Record<string, unknown>
}

export function DotInspectionScreen() {
  const { userId, deviceId, assignedTruckId } = useAuth()
  const { entries, audits, auditChainValid, exceptionSettings, shortHaulSession, clocks } = useHos()
  const { events } = useEvents()
  const { segments } = useUnassignedDriving()
  const days = pastDays(8)
  const [exportPreview, setExportPreview] = useState<string | null>(null)
  const [inspectionLocked, setInspectionLocked] = useState(false)
  const malfunctions = useMemo(
    () => events.filter((event) => event.eventType === "device_malfunction").slice(0, 8),
    [events]
  )
  const malfunctionStatus = useMemo(() => {
    const all = events.filter((event) => event.eventType === "device_malfunction")
    const faultLevel = all.filter((event) => event.severity === "warning" || event.severity === "critical")
    const active = faultLevel.filter((event) => !event.resolvedAt)
    const resolved = faultLevel.filter((event) => Boolean(event.resolvedAt))
    return {
      total: faultLevel.length,
      active: active.length,
      resolved: resolved.length,
      lastEventAt: all[0]?.eventTime,
    }
  }, [events])
  const malfunctionResolutionLog = useMemo<MalfunctionResolutionItem[]>(() => {
    const malfunctionEvents = events.filter((event) => event.eventType === "device_malfunction")
    return malfunctionEvents.map((event) => {
      const combinedText = `${event.title} ${event.description || ""}`.toLowerCase()
      let rootCause = "general_diagnostic"
      if (combinedText.includes("permission")) rootCause = "location_permission"
      else if (combinedText.includes("stale")) rootCause = "stale_location_feed"
      else if (combinedText.includes("stream") || combinedText.includes("interruption")) rootCause = "location_stream_interruption"

      return {
        event_id: event.id,
        event_time: event.eventTime,
        title: event.title,
        severity: event.severity,
        status: event.resolvedAt ? "resolved" : "active",
        resolved_at: event.resolvedAt,
        root_cause: rootCause,
        corrective_action: event.resolutionNote || event.acknowledgmentNote || "Not documented",
        proof_metadata: {
          acknowledged: event.acknowledged,
          acknowledged_at: event.acknowledgedAt,
          resolved_at: event.resolvedAt,
          metadata: event.metadata || {},
        },
      }
    })
  }, [events])

  const exportData = useMemo(() => {
    const startDay = days[days.length - 1]
    return {
      generated_at: new Date().toISOString(),
      driver_id: userId,
      device_id: deviceId,
      assigned_truck_id: assignedTruckId,
      period_start: startDay,
      period_end: days[0],
      duty_logs: entries.filter((entry) => entry.logDate >= startDay),
      hos_edit_audits: audits.filter((audit) => audit.editedAt.slice(0, 10) >= startDay),
      hos_exception_settings: exceptionSettings,
      short_haul_session: shortHaulSession,
      hos_clock_snapshot: clocks,
      events: events.filter((event) => event.eventTime.slice(0, 10) >= startDay),
      diagnostics_status: malfunctionStatus,
      malfunction_resolution_log: malfunctionResolutionLog,
      unassigned_segments: segments.filter((segment) => segment.startTime.slice(0, 10) >= startDay),
      declaration: "Prepared from TruckMates ELD mobile inspection mode.",
    }
  }, [
    days,
    entries,
    audits,
    exceptionSettings,
    shortHaulSession,
    clocks,
    events,
    malfunctionStatus,
    malfunctionResolutionLog,
    segments,
    userId,
    deviceId,
    assignedTruckId,
  ])

  async function sharePackage() {
    const payload = JSON.stringify(exportData, null, 2)
    setExportPreview(payload.slice(0, 1200))
    await Share.share({
      title: "DOT Inspection Export",
      message: payload,
    })
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>DOT Inspection Mode</Text>
      <Text style={styles.text}>
        Driver-facing quick view for roadside checks. Shows last 8 days of duty logs and critical events.
      </Text>
      <Text style={[styles.chainBadge, auditChainValid ? styles.good : styles.danger]}>
        Audit chain: {auditChainValid ? "VALID" : "COMPROMISED"}
      </Text>
      <Text style={[styles.chainBadge, shortHaulSession?.returnedToTerminal ? styles.good : styles.warn]}>
        Short-haul return:{" "}
        {shortHaulSession?.endedAt
          ? shortHaulSession.returnedToTerminal
            ? "CONFIRMED"
            : "NOT CONFIRMED"
          : "NOT COMPLETED"}
      </Text>
      {typeof shortHaulSession?.completionDistanceMiles === "number" ? (
        <Text style={styles.chainBadge}>
          Short-haul distance: {shortHaulSession.completionDistanceMiles.toFixed(2)} mi ({shortHaulSession.completionSource || "gps"})
        </Text>
      ) : null}
      <Text style={[styles.chainBadge, malfunctionStatus.active > 0 ? styles.danger : styles.good]}>
        Diagnostics status: {malfunctionStatus.active > 0 ? `${malfunctionStatus.active} active issue(s)` : "All resolved"}
      </Text>

      <Pressable
        style={[styles.lockButton, inspectionLocked && styles.unlockButton]}
        onPress={() => setInspectionLocked((prev) => !prev)}
      >
        <Text style={styles.lockButtonText}>{inspectionLocked ? "Exit Inspection Lock" : "Start Inspection Lock"}</Text>
      </Pressable>

      {inspectionLocked ? (
        <View style={styles.lockPanel}>
          <Text style={styles.lockHeader}>DOT INSPECTION ACTIVE</Text>
          <Text style={styles.lockLabel}>Driver ID</Text>
          <Text style={styles.lockValue}>{userId || "Unknown"}</Text>
          <Text style={styles.lockLabel}>Truck ID</Text>
          <Text style={styles.lockValue}>{assignedTruckId || "Not assigned"}</Text>
          <Text style={styles.lockLabel}>Device ID</Text>
          <Text style={styles.lockValue}>{deviceId || "Unknown"}</Text>
          <Text style={styles.lockHint}>Use this screen for roadside handoff. All data remains read-only.</Text>
        </View>
      ) : null}

      <Pressable style={styles.exportButton} onPress={() => void sharePackage()}>
        <Text style={styles.exportButtonText}>Generate / Share DOT Package</Text>
      </Pressable>
      {exportPreview ? (
        <View style={styles.preview}>
          <Text style={styles.previewTitle}>Export preview</Text>
          <Text style={styles.previewText}>{exportPreview}...</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.heading}>Last 8 Days Logs</Text>
        {days.map((day) => {
          const dayEntries = entries.filter((e) => e.logDate === day)
          const certified = dayEntries.length > 0 && dayEntries.every((e) => e.certified)
          return (
            <View key={day} style={styles.row}>
              <View>
                <Text style={styles.day}>{day}</Text>
                <Text style={styles.meta}>{dayEntries.length} record(s)</Text>
              </View>
              <Text style={[styles.badge, certified ? styles.good : styles.warn]}>
                {dayEntries.length === 0 ? "No logs" : certified ? "Certified" : "Uncertified"}
              </Text>
            </View>
          )
        })}
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>Critical/Warning Events</Text>
        {events.filter((e) => e.severity !== "info").slice(0, 10).map((event) => (
          <View key={event.id} style={styles.eventRow}>
            <Text style={[styles.eventSeverity, event.severity === "critical" ? styles.danger : styles.warn]}>
              {event.severity.toUpperCase()}
            </Text>
            <Text style={styles.eventTitle}>{event.title}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>Device Diagnostics</Text>
        <Text style={styles.meta}>
          Total: {malfunctionStatus.total} • Active: {malfunctionStatus.active} • Resolved: {malfunctionStatus.resolved}
        </Text>
        {malfunctionStatus.lastEventAt ? <Text style={styles.meta}>Last event: {new Date(malfunctionStatus.lastEventAt).toLocaleString()}</Text> : null}
        {malfunctions.length === 0 ? (
          <Text style={styles.meta}>No device malfunction events in current view.</Text>
        ) : (
          malfunctions.map((event) => (
            <View key={event.id} style={styles.eventRow}>
              <Text style={[styles.eventSeverity, event.severity === "critical" ? styles.danger : styles.warn]}>
                {event.severity.toUpperCase()}
              </Text>
              <Text style={styles.eventTitle}>
                {event.title}
                {event.resolvedAt ? " (resolved)" : ""}
              </Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>Malfunction Resolution Log</Text>
        {malfunctionResolutionLog.length === 0 ? (
          <Text style={styles.meta}>No malfunction resolution records yet.</Text>
        ) : (
          malfunctionResolutionLog.slice(0, 8).map((item) => (
            <View key={item.event_id} style={styles.resolutionRow}>
              <Text style={styles.eventTitle}>
                {item.title} [{item.status.toUpperCase()}]
              </Text>
              <Text style={styles.meta}>Cause: {item.root_cause.replaceAll("_", " ")}</Text>
              <Text style={styles.meta}>Action: {item.corrective_action}</Text>
              <Text style={styles.meta}>
                Time: {new Date(item.event_time).toLocaleString()}
                {item.resolved_at ? ` -> ${new Date(item.resolved_at).toLocaleString()}` : ""}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, minHeight: "100%", padding: 20, gap: 12 },
  title: { color: colors.text, fontSize: 22, fontWeight: "700" },
  text: { color: colors.mutedText, lineHeight: 22 },
  chainBadge: { fontWeight: "700", fontSize: 12 },
  lockButton: {
    backgroundColor: colors.warning,
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 12,
  },
  unlockButton: {
    backgroundColor: colors.danger,
  },
  lockButtonText: { color: colors.text, fontWeight: "700" },
  lockPanel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  lockHeader: { color: colors.warning, fontWeight: "800", fontSize: 18 },
  lockLabel: { color: colors.mutedText, fontSize: 12 },
  lockValue: { color: colors.text, fontWeight: "700", fontSize: 15 },
  lockHint: { color: colors.mutedText, marginTop: 6, fontSize: 12 },
  exportButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 12,
  },
  exportButtonText: { color: colors.text, fontWeight: "700" },
  preview: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  previewTitle: { color: colors.text, fontWeight: "700" },
  previewText: { color: colors.mutedText, fontSize: 12 },
  section: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  heading: { color: colors.text, fontWeight: "700" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  day: { color: colors.text, fontWeight: "600" },
  meta: { color: colors.mutedText, fontSize: 12 },
  badge: { fontSize: 12, fontWeight: "700" },
  good: { color: colors.success },
  warn: { color: colors.warning },
  danger: { color: colors.danger },
  eventRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  eventSeverity: { fontSize: 11, fontWeight: "700", minWidth: 60 },
  eventTitle: { color: colors.text, flex: 1 },
  resolutionRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 8,
    gap: 3,
    backgroundColor: colors.background,
  },
})
