import React, { useEffect, useMemo, useState } from "react"
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native"
import { useHos } from "../context/HosContext"
import { computeHosClocksWithSettings, formatMinutes } from "../services/hos-engine"
import { colors } from "../theme/tokens"

function hhmm(iso: string | undefined): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const h = String(date.getHours()).padStart(2, "0")
  const m = String(date.getMinutes()).padStart(2, "0")
  return `${h}:${m}`
}

export function HosScreen() {
  const {
    entries,
    audits,
    auditChainValid,
    exceptionSettings,
    certifyToday,
    editEntry,
    annotateEntry,
    transferToCoDriver,
    setAdverseDrivingCondition,
    shortHaulSession,
    startShortHaulSession,
    completeShortHaulSession,
  } = useHos()
  const today = new Date().toISOString().slice(0, 10)
  const todayEntries = entries.filter((entry) => entry.logDate === today).slice().reverse()
  const allCertified = todayEntries.length > 0 && todayEntries.every((entry) => entry.certified)
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [startInput, setStartInput] = useState("")
  const [endInput, setEndInput] = useState("")
  const [reason, setReason] = useState("")
  const [annotationInput, setAnnotationInput] = useState("")
  const [coDriverInput, setCoDriverInput] = useState("")
  const [coDriverReason, setCoDriverReason] = useState("")
  const [adverseEnabled, setAdverseEnabled] = useState(exceptionSettings.adverseDrivingEnabled)
  const [adverseReason, setAdverseReason] = useState(exceptionSettings.adverseDrivingReason)
  const [shortHaulTerminal, setShortHaulTerminal] = useState(shortHaulSession?.terminalName || "")
  const [shortHaulRadius, setShortHaulRadius] = useState(shortHaulSession ? String(shortHaulSession.radiusMiles) : "150")
  const [shortHaulNotes, setShortHaulNotes] = useState(shortHaulSession?.notes || "")
  const [useManualReturnOverride, setUseManualReturnOverride] = useState(false)
  const [returnedToTerminal, setReturnedToTerminal] = useState(shortHaulSession?.returnedToTerminal ?? true)
  const [nowIso, setNowIso] = useState(() => new Date().toISOString())
  const selectedEntry = useMemo(() => entries.find((entry) => entry.id === selectedEntryId) || null, [entries, selectedEntryId])
  const clocks = useMemo(
    () => computeHosClocksWithSettings(entries, exceptionSettings, nowIso),
    [entries, exceptionSettings, nowIso]
  )

  useEffect(() => {
    setAdverseEnabled(exceptionSettings.adverseDrivingEnabled)
    setAdverseReason(exceptionSettings.adverseDrivingReason)
  }, [exceptionSettings])

  useEffect(() => {
    if (!shortHaulSession) return
    setShortHaulTerminal(shortHaulSession.terminalName)
    setShortHaulRadius(String(shortHaulSession.radiusMiles))
    setShortHaulNotes(shortHaulSession.notes || "")
    setReturnedToTerminal(shortHaulSession.returnedToTerminal ?? true)
  }, [shortHaulSession])

  useEffect(() => {
    const timer = setInterval(() => {
      setNowIso(new Date().toISOString())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  function beginEdit(entryId: string) {
    const entry = entries.find((item) => item.id === entryId)
    if (!entry) return
    setSelectedEntryId(entry.id)
    setStartInput(hhmm(entry.startTime))
    setEndInput(hhmm(entry.endTime))
    setReason("")
    setAnnotationInput(entry.annotation || "")
    setCoDriverInput(entry.coDriverTransferTo || "")
    setCoDriverReason("")
  }

  async function submitEdit() {
    if (!selectedEntry) return
    try {
      await editEntry({
        entryId: selectedEntry.id,
        startTime: startInput,
        endTime: endInput.trim() || undefined,
        reason,
      })
      Alert.alert("Log updated", "HOS edit saved with audit reason.")
      setSelectedEntryId(null)
      setReason("")
    } catch (e) {
      Alert.alert("Edit failed", e instanceof Error ? e.message : "Unable to edit log entry")
    }
  }

  async function submitAnnotation() {
    if (!selectedEntry) return
    try {
      await annotateEntry({ entryId: selectedEntry.id, note: annotationInput })
      Alert.alert("Annotation saved", "Driver annotation was saved.")
    } catch (e) {
      Alert.alert("Annotation failed", e instanceof Error ? e.message : "Unable to add annotation")
    }
  }

  async function submitCoDriverTransfer() {
    if (!selectedEntry) return
    try {
      await transferToCoDriver({
        entryId: selectedEntry.id,
        coDriverId: coDriverInput,
        reason: coDriverReason,
      })
      Alert.alert("Transfer marked", "Co-driver transfer marker saved.")
      setCoDriverReason("")
    } catch (e) {
      Alert.alert("Transfer failed", e instanceof Error ? e.message : "Unable to mark co-driver transfer")
    }
  }

  async function applyAdverse() {
    try {
      await setAdverseDrivingCondition({
        enabled: adverseEnabled,
        reason: adverseReason,
      })
      Alert.alert("HOS exception updated", adverseEnabled ? "Adverse driving condition enabled." : "Adverse driving condition disabled.")
    } catch (e) {
      Alert.alert("Update failed", e instanceof Error ? e.message : "Unable to update adverse condition")
    }
  }

  async function beginShortHaul() {
    try {
      await startShortHaulSession({
        terminalName: shortHaulTerminal,
        radiusMiles: Number(shortHaulRadius),
        notes: shortHaulNotes,
      })
      Alert.alert("Short-haul started", "Session baseline captured for inspection records.")
    } catch (e) {
      Alert.alert("Start failed", e instanceof Error ? e.message : "Unable to start short-haul session")
    }
  }

  async function endShortHaul() {
    try {
      await completeShortHaulSession({
        returnedToTerminal: useManualReturnOverride ? returnedToTerminal : undefined,
        notes: shortHaulNotes,
      })
      Alert.alert("Short-haul completed", "Return signal saved for DOT export.")
    } catch (e) {
      Alert.alert("Complete failed", e instanceof Error ? e.message : "Unable to complete short-haul session")
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>HOS & Logs</Text>
      <Text style={styles.text}>
        Driver clocks are calculated from local duty logs and can be synced through the ELD queue.
      </Text>

      <View style={styles.clocks}>
        <Text style={styles.clock}>Drive left: {formatMinutes(clocks.driveMinutesLeft)}</Text>
        <Text style={styles.clock}>Shift left: {formatMinutes(clocks.shiftMinutesLeft)}</Text>
        <Text style={styles.clock}>Cycle left: {formatMinutes(clocks.cycleMinutesLeft)}</Text>
        <Text style={styles.clock}>Effective drive limit: {formatMinutes(clocks.effectiveDriveLimitMinutes)}</Text>
        <Text style={styles.clock}>Effective shift limit: {formatMinutes(clocks.effectiveShiftLimitMinutes)}</Text>
        <Text style={styles.clock}>Break due in: {formatMinutes(clocks.breakDueInMinutes)}</Text>
        <Text style={styles.clock}>Current break progress: {formatMinutes(clocks.currentBreakProgressMinutes)}</Text>
        <Text style={[styles.clock, clocks.shortHaulEligible ? styles.certOk : styles.certNo]}>
          Short-haul: {clocks.shortHaulStatus}
        </Text>
        <Text style={[styles.clock, clocks.splitSleeperEligible ? styles.certOk : styles.certNo]}>
          Split sleeper: {clocks.splitSleeperStatus}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.cardTitle}>Exception Handling</Text>
        <View style={styles.switchRow}>
          <Text style={styles.helpText}>Adverse driving condition</Text>
          <Switch value={adverseEnabled} onValueChange={setAdverseEnabled} />
        </View>
        <TextInput
          style={[styles.input, styles.reasonInput]}
          value={adverseReason}
          onChangeText={setAdverseReason}
          placeholder="Reason (weather/traffic/emergency)"
          placeholderTextColor={colors.mutedText}
          multiline
        />
        <Pressable style={styles.secondaryButton} onPress={() => void applyAdverse()}>
          <Text style={styles.buttonText}>Apply Exception</Text>
        </Pressable>
        <Text style={[styles.helpText, clocks.adverseConditionApplied ? styles.certOk : styles.certNo]}>
          Current adverse extension: {clocks.adverseConditionApplied ? "Active (+2h)" : "Inactive"}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.cardTitle}>Short-Haul Session Evidence</Text>
        <TextInput
          style={styles.input}
          value={shortHaulTerminal}
          onChangeText={setShortHaulTerminal}
          placeholder="Home terminal name"
          placeholderTextColor={colors.mutedText}
        />
        <TextInput
          style={styles.input}
          value={shortHaulRadius}
          onChangeText={setShortHaulRadius}
          placeholder="Radius miles (e.g. 150)"
          placeholderTextColor={colors.mutedText}
          keyboardType="numeric"
        />
        <TextInput
          style={[styles.input, styles.reasonInput]}
          value={shortHaulNotes}
          onChangeText={setShortHaulNotes}
          placeholder="Operational note (optional)"
          placeholderTextColor={colors.mutedText}
          multiline
        />
        <View style={styles.switchRow}>
          <Text style={styles.helpText}>Use manual return override</Text>
          <Switch value={useManualReturnOverride} onValueChange={setUseManualReturnOverride} />
        </View>
        {useManualReturnOverride ? (
          <View style={styles.switchRow}>
            <Text style={styles.helpText}>Returned to terminal</Text>
            <Switch value={returnedToTerminal} onValueChange={setReturnedToTerminal} />
          </View>
        ) : null}
        <View style={styles.editorActions}>
          <Pressable style={styles.secondaryButton} onPress={() => void beginShortHaul()}>
            <Text style={styles.buttonText}>Start Session</Text>
          </Pressable>
          <Pressable style={styles.saveButton} onPress={() => void endShortHaul()}>
            <Text style={styles.buttonText}>Complete Session</Text>
          </Pressable>
        </View>
        <Text style={styles.helpText}>
          Active: {shortHaulSession?.startedAt ? new Date(shortHaulSession.startedAt).toLocaleString() : "Not started"}
        </Text>
        {shortHaulSession?.terminalLatitude && shortHaulSession?.terminalLongitude ? (
          <Text style={styles.helpText}>
            GPS anchor: {shortHaulSession.terminalLatitude.toFixed(4)}, {shortHaulSession.terminalLongitude.toFixed(4)}
          </Text>
        ) : null}
        {typeof shortHaulSession?.completionDistanceMiles === "number" ? (
          <Text style={styles.helpText}>
            Completion distance: {shortHaulSession.completionDistanceMiles.toFixed(2)} mi ({shortHaulSession.completionSource || "gps"})
          </Text>
        ) : null}
        <Text style={[styles.helpText, shortHaulSession?.returnedToTerminal ? styles.certOk : styles.certNo]}>
          Return status:{" "}
          {shortHaulSession?.endedAt
            ? shortHaulSession.returnedToTerminal
              ? "Returned and closed"
              : "Closed without terminal return"
            : "Not completed"}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.cardTitle}>Today ({today})</Text>
        {todayEntries.length === 0 ? (
          <Text style={styles.empty}>No duty status records yet.</Text>
        ) : (
          todayEntries.map((entry) => (
            <View key={entry.id} style={styles.logRow}>
              <Text style={styles.logStatus}>{entry.status.replace("_", " ")}</Text>
              <Text style={styles.logTime}>
                {new Date(entry.startTime).toLocaleTimeString()} - {entry.endTime ? new Date(entry.endTime).toLocaleTimeString() : "Active"}
              </Text>
              {entry.edited ? <Text style={styles.editedTag}>Edited</Text> : null}
              {entry.annotation ? <Text style={styles.metaTag}>Annotation: {entry.annotation}</Text> : null}
              {entry.coDriverTransferTo ? <Text style={styles.metaTag}>Co-driver transfer: {entry.coDriverTransferTo}</Text> : null}
              <Text style={[styles.cert, entry.certified ? styles.certOk : styles.certNo]}>
                {entry.certified ? "Certified" : "Not certified"}
              </Text>
              <Pressable style={styles.editButton} onPress={() => beginEdit(entry.id)}>
                <Text style={styles.editButtonText}>Edit</Text>
              </Pressable>
            </View>
          ))
        )}
      </View>

      {selectedEntry ? (
        <View style={styles.editor}>
          <Text style={styles.cardTitle}>Edit Selected Log</Text>
          <Text style={styles.helpText}>Enter time in 24h format (HH:mm). Reason is required.</Text>
          <TextInput
            style={styles.input}
            value={startInput}
            onChangeText={setStartInput}
            placeholder="Start time (HH:mm)"
            placeholderTextColor={colors.mutedText}
          />
          <TextInput
            style={styles.input}
            value={endInput}
            onChangeText={setEndInput}
            placeholder="End time (HH:mm)"
            placeholderTextColor={colors.mutedText}
          />
          <TextInput
            style={[styles.input, styles.reasonInput]}
            value={reason}
            onChangeText={setReason}
            placeholder="Edit reason"
            placeholderTextColor={colors.mutedText}
            multiline
          />
          <View style={styles.editorActions}>
            <Pressable style={styles.cancelButton} onPress={() => setSelectedEntryId(null)}>
              <Text style={styles.buttonText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.saveButton} onPress={() => void submitEdit()}>
              <Text style={styles.buttonText}>Save Edit</Text>
            </Pressable>
          </View>

          <Text style={styles.cardTitle}>Driver Annotation</Text>
          <TextInput
            style={[styles.input, styles.reasonInput]}
            value={annotationInput}
            onChangeText={setAnnotationInput}
            placeholder="Add note for this log segment"
            placeholderTextColor={colors.mutedText}
            multiline
          />
          <Pressable style={styles.secondaryButton} onPress={() => void submitAnnotation()}>
            <Text style={styles.buttonText}>Save Annotation</Text>
          </Pressable>

          <Text style={styles.cardTitle}>Co-Driver Transfer Marker</Text>
          <TextInput
            style={styles.input}
            value={coDriverInput}
            onChangeText={setCoDriverInput}
            placeholder="Co-driver ID"
            placeholderTextColor={colors.mutedText}
          />
          <TextInput
            style={[styles.input, styles.reasonInput]}
            value={coDriverReason}
            onChangeText={setCoDriverReason}
            placeholder="Transfer reason"
            placeholderTextColor={colors.mutedText}
            multiline
          />
          <Pressable style={styles.secondaryButton} onPress={() => void submitCoDriverTransfer()}>
            <Text style={styles.buttonText}>Mark Transfer</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.cardTitle}>Edit Audit Trail</Text>
        <Text style={[styles.chainState, auditChainValid ? styles.certOk : styles.certNo]}>
          Chain integrity: {auditChainValid ? "Valid" : "Compromised"}
        </Text>
        {audits.length === 0 ? (
          <Text style={styles.empty}>No edits recorded yet.</Text>
        ) : (
          audits.slice(0, 8).map((audit) => (
            <View key={audit.id} style={styles.auditRow}>
              <Text style={styles.auditTime}>{new Date(audit.editedAt).toLocaleString()}</Text>
              <Text style={styles.auditReason}>
                [{audit.actionType.replace("_", " ")}] {audit.reason}
              </Text>
              <Text style={styles.auditChange}>
                {new Date(audit.before.startTime).toLocaleTimeString()}-{audit.before.endTime ? new Date(audit.before.endTime).toLocaleTimeString() : "Active"}
                {" -> "}
                {new Date(audit.after.startTime).toLocaleTimeString()}-{audit.after.endTime ? new Date(audit.after.endTime).toLocaleTimeString() : "Active"}
              </Text>
              <Text style={styles.auditHash}>hash: {audit.hash}</Text>
            </View>
          ))
        )}
      </View>

      <Pressable style={[styles.button, allCertified && styles.buttonDisabled]} onPress={() => void certifyToday()} disabled={allCertified}>
        <Text style={styles.buttonText}>{allCertified ? "Already certified today" : "Certify today logs"}</Text>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, padding: 20, gap: 12, minHeight: "100%" },
  title: { color: colors.text, fontSize: 22, fontWeight: "700" },
  text: { color: colors.mutedText, lineHeight: 22 },
  clocks: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  clock: { color: colors.text, fontWeight: "600" },
  section: { marginTop: 8, gap: 8 },
  cardTitle: { color: colors.warning, fontSize: 16, fontWeight: "700" },
  empty: { color: colors.mutedText },
  logRow: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    gap: 2,
  },
  logStatus: { color: colors.text, fontWeight: "700", textTransform: "capitalize" },
  logTime: { color: colors.mutedText, fontSize: 12 },
  editedTag: { color: colors.warning, fontSize: 11, fontWeight: "700" },
  metaTag: { color: colors.mutedText, fontSize: 11 },
  cert: { fontSize: 12, fontWeight: "600" },
  certOk: { color: colors.success },
  certNo: { color: colors.warning },
  editButton: {
    marginTop: 4,
    alignSelf: "flex-start",
    borderRadius: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  editButtonText: { color: colors.text, fontWeight: "700", fontSize: 12 },
  editor: {
    marginTop: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  helpText: { color: colors.mutedText, fontSize: 12 },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.background,
    color: colors.text,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  reasonInput: { minHeight: 64, textAlignVertical: "top" },
  editorActions: { flexDirection: "row", gap: 8 },
  cancelButton: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: colors.danger,
    alignItems: "center",
    paddingVertical: 10,
  },
  saveButton: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: colors.success,
    alignItems: "center",
    paddingVertical: 10,
  },
  secondaryButton: {
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    paddingVertical: 10,
  },
  chainState: { fontSize: 12, fontWeight: "700" },
  auditRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    gap: 3,
    backgroundColor: colors.surface,
  },
  auditTime: { color: colors.mutedText, fontSize: 11 },
  auditReason: { color: colors.text, fontWeight: "700" },
  auditChange: { color: colors.mutedText, fontSize: 12 },
  auditHash: { color: colors.mutedText, fontSize: 10 },
  button: {
    marginTop: 12,
    backgroundColor: colors.primary,
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 12,
  },
  buttonDisabled: { opacity: 0.55 },
  buttonText: { color: colors.text, fontWeight: "700" },
})
