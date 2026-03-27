import React, { useMemo, useState } from "react"
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native"
import { useAuth } from "../context/AuthContext"
import { useDvir } from "../context/DvirContext"
import { colors } from "../theme/tokens"
import type { DvirDefect, ELDDvir } from "../types/eld"

export function DvirScreen() {
  const { userId } = useAuth()
  const { reports, submitDvir } = useDvir()
  const [inspectionType, setInspectionType] = useState<"pre_trip" | "post_trip" | "on_road">("pre_trip")
  const [truckId, setTruckId] = useState("")
  const [location, setLocation] = useState("")
  const [odometer, setOdometer] = useState("")
  const [notes, setNotes] = useState("")
  const [safeToOperate, setSafeToOperate] = useState(true)
  const [defectComponent, setDefectComponent] = useState("")
  const [defectDescription, setDefectDescription] = useState("")
  const [defectSeverity, setDefectSeverity] = useState<"minor" | "major" | "critical">("minor")
  const [defects, setDefects] = useState<DvirDefect[]>([])
  const [submitting, setSubmitting] = useState(false)

  const recentReports = useMemo(() => reports.slice(0, 5), [reports])

  function addDefect() {
    if (!defectComponent.trim() || !defectDescription.trim()) {
      Alert.alert("Missing defect details", "Add both component and description.")
      return
    }
    setDefects((prev) => [
      ...prev,
      {
        component: defectComponent.trim(),
        description: defectDescription.trim(),
        severity: defectSeverity,
      },
    ])
    setDefectComponent("")
    setDefectDescription("")
    setDefectSeverity("minor")
  }

  async function submitInspection() {
    if (!truckId.trim()) {
      Alert.alert("Truck required", "Enter truck ID assigned to this driver.")
      return
    }

    const payload: ELDDvir = {
      truck_id: truckId.trim(),
      driver_id: userId || undefined,
      inspection_type: inspectionType,
      inspection_date: new Date().toISOString().slice(0, 10),
      inspection_time: new Date().toISOString().slice(11, 16),
      location: location.trim() || undefined,
      odometer_reading: odometer.trim() ? Number(odometer) : undefined,
      defects_found: defects.length > 0,
      safe_to_operate: safeToOperate,
      defects: defects.length ? defects : undefined,
      notes: notes.trim() || undefined,
      driver_signature: userId || "driver",
    }

    setSubmitting(true)
    try {
      await submitDvir(payload)
      Alert.alert("DVIR saved", "Inspection queued for sync.")
      setDefects([])
      setNotes("")
      setLocation("")
      setOdometer("")
      setSafeToOperate(true)
    } catch (e) {
      Alert.alert("DVIR error", e instanceof Error ? e.message : "Unable to save inspection")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>DVIR</Text>
      <Text style={styles.text}>Submit compliant pre-trip and post-trip inspections with defect tracking.</Text>

      <View style={styles.section}>
        <Text style={styles.label}>Inspection Type</Text>
        <View style={styles.row}>
          {(["pre_trip", "post_trip", "on_road"] as const).map((item) => (
            <Pressable
              key={item}
              onPress={() => setInspectionType(item)}
              style={[styles.chip, inspectionType === item && styles.chipActive]}
            >
              <Text style={styles.chipText}>{item.replace("_", " ")}</Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          style={styles.input}
          placeholder="Truck ID"
          placeholderTextColor={colors.mutedText}
          value={truckId}
          onChangeText={setTruckId}
        />
        <TextInput
          style={styles.input}
          placeholder="Current location (address or lat/lng)"
          placeholderTextColor={colors.mutedText}
          value={location}
          onChangeText={setLocation}
        />
        <TextInput
          style={styles.input}
          placeholder="Odometer reading"
          placeholderTextColor={colors.mutedText}
          keyboardType="numeric"
          value={odometer}
          onChangeText={setOdometer}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Safe to Operate</Text>
        <View style={styles.switchRow}>
          <Text style={styles.switchText}>{safeToOperate ? "Yes" : "No"}</Text>
          <Switch value={safeToOperate} onValueChange={setSafeToOperate} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Add Defect</Text>
        <TextInput
          style={styles.input}
          placeholder="Component (e.g., brakes, tires)"
          placeholderTextColor={colors.mutedText}
          value={defectComponent}
          onChangeText={setDefectComponent}
        />
        <TextInput
          style={styles.input}
          placeholder="Defect description"
          placeholderTextColor={colors.mutedText}
          value={defectDescription}
          onChangeText={setDefectDescription}
          multiline
        />
        <View style={styles.row}>
          {(["minor", "major", "critical"] as const).map((sev) => (
            <Pressable key={sev} style={[styles.chip, defectSeverity === sev && styles.chipActive]} onPress={() => setDefectSeverity(sev)}>
              <Text style={styles.chipText}>{sev}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={styles.smallButton} onPress={addDefect}>
          <Text style={styles.buttonText}>Add defect</Text>
        </Pressable>

        {defects.map((defect, idx) => (
          <View key={`${defect.component}-${idx}`} style={styles.defectCard}>
            <Text style={styles.defectTitle}>{defect.component}</Text>
            <Text style={styles.defectBody}>{defect.description}</Text>
            <Text style={styles.defectSeverity}>{defect.severity}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Driver Notes</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          placeholder="Optional notes / corrective action"
          placeholderTextColor={colors.mutedText}
          value={notes}
          onChangeText={setNotes}
          multiline
        />
      </View>

      <Pressable style={[styles.submit, submitting && styles.disabled]} onPress={() => void submitInspection()} disabled={submitting}>
        <Text style={styles.buttonText}>{submitting ? "Saving..." : "Submit DVIR"}</Text>
      </Pressable>

      <View style={styles.section}>
        <Text style={styles.label}>Recent Reports</Text>
        {recentReports.length === 0 ? (
          <Text style={styles.text}>No inspections yet.</Text>
        ) : (
          recentReports.map((report) => (
            <View key={report.id} style={styles.reportCard}>
              <Text style={styles.reportTitle}>{report.payload.inspection_type.replace("_", " ")}</Text>
              <Text style={styles.reportMeta}>
                {report.payload.inspection_date} {report.payload.inspection_time || ""}
              </Text>
              <Text style={styles.reportMeta}>Status: {report.payload.status}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, padding: 20, gap: 12, minHeight: "100%" },
  title: { color: colors.text, fontSize: 22, fontWeight: "700" },
  text: { color: colors.mutedText, lineHeight: 22 },
  section: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  label: { color: colors.text, fontWeight: "700" },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipActive: { borderColor: colors.primary },
  chipText: { color: colors.text, textTransform: "capitalize" },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.background,
    color: colors.text,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  notesInput: { minHeight: 72, textAlignVertical: "top" },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  switchText: { color: colors.text, fontWeight: "600" },
  smallButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    alignItems: "center",
    paddingVertical: 10,
  },
  submit: {
    backgroundColor: colors.success,
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 12,
  },
  disabled: { opacity: 0.65 },
  buttonText: { color: colors.text, fontWeight: "700" },
  defectCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 8,
    gap: 2,
  },
  defectTitle: { color: colors.text, fontWeight: "700" },
  defectBody: { color: colors.mutedText },
  defectSeverity: { color: colors.warning, textTransform: "capitalize", fontWeight: "600", fontSize: 12 },
  reportCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 8,
    gap: 2,
  },
  reportTitle: { color: colors.text, fontWeight: "700", textTransform: "capitalize" },
  reportMeta: { color: colors.mutedText, fontSize: 12 },
})
