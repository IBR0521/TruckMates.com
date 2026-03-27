import React, { useState } from "react"
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { useEvents } from "../context/EventContext"
import { useUnassignedDriving } from "../context/UnassignedDrivingContext"
import { colors } from "../theme/tokens"
import type { DriverEvent } from "../types/events"

type MalfunctionPlaybook = {
  key: "permission" | "stale_feed" | "stream" | "generic"
  title: string
  steps: string[]
  templateNote: string
}

function getPlaybook(event: DriverEvent): MalfunctionPlaybook {
  const text = `${event.title} ${event.description || ""}`.toLowerCase()
  if (text.includes("permission")) {
    return {
      key: "permission",
      title: "Location Permission Recovery",
      steps: [
        "Open OS settings and re-enable foreground and background location permissions.",
        "Return to app and toggle automatic ELD monitoring off, then back on.",
        "Confirm fresh location events appear in Violation Center.",
      ],
      templateNote: "Driver restored foreground/background location permission and restarted automatic ELD monitoring.",
    }
  }
  if (text.includes("stale")) {
    return {
      key: "stale_feed",
      title: "Stale Location Feed Recovery",
      steps: [
        "Move vehicle/device to open sky and verify GPS signal is available.",
        "Keep app active for at least one position interval and confirm speed/position updates.",
        "Verify no new stale feed warnings appear after monitoring resumes.",
      ],
      templateNote: "Driver verified GPS reception and confirmed fresh position updates after stale-feed warning.",
    }
  }
  if (text.includes("stream") || text.includes("interruption")) {
    return {
      key: "stream",
      title: "Location Stream Interruption Recovery",
      steps: [
        "Restart automatic ELD monitoring to re-establish location stream.",
        "Check network/GPS availability and confirm app remains in foreground briefly.",
        "Confirm recovery event is recorded and no repeat interruption occurs.",
      ],
      templateNote: "Driver restarted monitoring and validated location stream recovery with fresh telemetry events.",
    }
  }
  return {
    key: "generic",
    title: "General ELD Diagnostic Recovery",
    steps: [
      "Review device permissions, connectivity, and GPS status.",
      "Restart automatic monitoring and validate new telemetry entries.",
      "Document corrective steps taken and verify no recurring malfunction events.",
    ],
    templateNote: "Driver completed diagnostic troubleshooting checklist and verified monitoring returned to healthy state.",
  }
}

export function ViolationsScreen() {
  const { events, acknowledgeEvent } = useEvents()
  const { segments, claimSegment, rejectSegment } = useUnassignedDriving()
  const ordered = [...events].sort((a, b) => +new Date(b.eventTime) - +new Date(a.eventTime))
  const pendingSegments = segments.filter((segment) => !segment.claimed)
  const [noteByEventId, setNoteByEventId] = useState<Record<string, string>>({})
  const activeMalfunctions = ordered.filter((event) => event.eventType === "device_malfunction" && !event.resolvedAt).length

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Violation Center</Text>
      <Text style={styles.text}>Review warnings and critical events, then acknowledge after review.</Text>
      <View style={styles.statusChip}>
        <Text style={styles.statusChipText}>Active device malfunctions: {activeMalfunctions}</Text>
      </View>

      <View style={styles.unassignedSection}>
        <Text style={styles.subTitle}>Unassigned Driving Review</Text>
        {pendingSegments.length === 0 ? (
          <Text style={styles.empty}>No pending unassigned segments.</Text>
        ) : (
          pendingSegments.map((segment) => (
            <View key={segment.id} style={styles.segmentCard}>
              <Text style={styles.segmentText}>
                {new Date(segment.startTime).toLocaleString()} - {segment.endTime ? new Date(segment.endTime).toLocaleString() : "Active"}
              </Text>
              <Text style={styles.segmentMeta}>{segment.reason}</Text>
              <View style={styles.segmentActions}>
                <Pressable style={styles.rejectButton} onPress={() => void rejectSegment(segment.id)}>
                  <Text style={styles.segmentButtonText}>Reject</Text>
                </Pressable>
                <Pressable style={styles.claimButton} onPress={() => void claimSegment(segment.id)}>
                  <Text style={styles.segmentButtonText}>Claim</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </View>

      {ordered.length === 0 ? (
        <Text style={styles.empty}>No events yet.</Text>
      ) : (
        ordered.map((event) => (
          <View key={event.id} style={[styles.card, event.eventType === "device_malfunction" && styles.malfunctionCard]}>
            <View style={styles.row}>
              <Text style={[styles.severity, event.severity === "critical" ? styles.critical : event.severity === "warning" ? styles.warning : styles.info]}>
                {event.severity.toUpperCase()}
              </Text>
              <Text style={styles.time}>{new Date(event.eventTime).toLocaleString()}</Text>
            </View>
            <Text style={styles.eventTitle}>{event.title}</Text>
            {event.description ? <Text style={styles.desc}>{event.description}</Text> : null}
            <Text style={styles.meta}>Type: {event.eventType.replace("_", " ")}</Text>
            {event.eventType === "device_malfunction" ? <Text style={styles.malfunctionHint}>Device diagnostics event</Text> : null}
            {event.acknowledgedAt ? <Text style={styles.meta}>Acknowledged: {new Date(event.acknowledgedAt).toLocaleString()}</Text> : null}
            {event.resolvedAt ? <Text style={styles.meta}>Resolved: {new Date(event.resolvedAt).toLocaleString()}</Text> : null}
            {event.acknowledgmentNote ? <Text style={styles.meta}>Note: {event.acknowledgmentNote}</Text> : null}
            {event.resolutionNote ? <Text style={styles.meta}>Resolution: {event.resolutionNote}</Text> : null}

            {event.eventType === "device_malfunction" ? (
              <View style={styles.playbookCard}>
                <Text style={styles.playbookTitle}>{getPlaybook(event).title}</Text>
                {getPlaybook(event).steps.map((step) => (
                  <Text key={`${event.id}-${step}`} style={styles.playbookStep}>
                    - {step}
                  </Text>
                ))}
                {!event.acknowledged ? (
                  <Pressable
                    style={styles.templateButton}
                    onPress={() =>
                      setNoteByEventId((prev) => ({
                        ...prev,
                        [event.id]: getPlaybook(event).templateNote,
                      }))
                    }
                  >
                    <Text style={styles.templateButtonText}>Use Corrective Template</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {!event.acknowledged ? (
              <TextInput
                style={styles.noteInput}
                value={noteByEventId[event.id] || ""}
                onChangeText={(value) =>
                  setNoteByEventId((prev) => ({
                    ...prev,
                    [event.id]: value,
                  }))
                }
                placeholder={event.eventType === "device_malfunction" ? "Resolution note (recommended)" : "Acknowledgment note (optional)"}
                placeholderTextColor={colors.mutedText}
                multiline
              />
            ) : null}

            <Pressable
              style={[styles.button, event.acknowledged && styles.buttonDisabled]}
              onPress={() => void acknowledgeEvent(event.id, noteByEventId[event.id])}
              disabled={event.acknowledged}
            >
              <Text style={styles.buttonText}>
                {event.acknowledged ? "Acknowledged" : event.eventType === "device_malfunction" ? "Acknowledge & Resolve" : "Acknowledge"}
              </Text>
            </Pressable>
          </View>
        ))
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, minHeight: "100%", padding: 20, gap: 10 },
  title: { color: colors.text, fontSize: 22, fontWeight: "700" },
  subTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  text: { color: colors.mutedText, lineHeight: 22 },
  statusChip: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.warning,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusChipText: { color: colors.warning, fontWeight: "700", fontSize: 12 },
  empty: { color: colors.mutedText, marginTop: 8 },
  unassignedSection: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  segmentCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 8,
    gap: 4,
  },
  segmentText: { color: colors.text, fontWeight: "600", fontSize: 12 },
  segmentMeta: { color: colors.mutedText, fontSize: 12 },
  segmentActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  claimButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 8,
    alignItems: "center",
    paddingVertical: 9,
  },
  rejectButton: {
    flex: 1,
    backgroundColor: colors.danger,
    borderRadius: 8,
    alignItems: "center",
    paddingVertical: 9,
  },
  segmentButtonText: { color: colors.text, fontWeight: "700" },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  malfunctionCard: {
    borderColor: colors.warning,
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  severity: { fontWeight: "700", fontSize: 11 },
  critical: { color: colors.danger },
  warning: { color: colors.warning },
  info: { color: colors.primary },
  time: { color: colors.mutedText, fontSize: 11 },
  eventTitle: { color: colors.text, fontWeight: "700" },
  desc: { color: colors.mutedText },
  meta: { color: colors.mutedText, fontSize: 12, textTransform: "capitalize" },
  malfunctionHint: { color: colors.warning, fontSize: 11, fontWeight: "700" },
  playbookCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.background,
    padding: 8,
    gap: 4,
  },
  playbookTitle: { color: colors.text, fontWeight: "700", fontSize: 12 },
  playbookStep: { color: colors.mutedText, fontSize: 12, lineHeight: 16 },
  templateButton: {
    marginTop: 4,
    backgroundColor: colors.warning,
    borderRadius: 8,
    alignItems: "center",
    paddingVertical: 8,
  },
  templateButtonText: { color: colors.text, fontWeight: "700", fontSize: 12 },
  noteInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.background,
    color: colors.text,
    minHeight: 58,
    textAlignVertical: "top",
    paddingHorizontal: 9,
    paddingVertical: 8,
  },
  button: {
    marginTop: 2,
    backgroundColor: colors.primary,
    borderRadius: 8,
    alignItems: "center",
    paddingVertical: 10,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.text, fontWeight: "700" },
})
