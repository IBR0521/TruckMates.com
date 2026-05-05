import React, { useEffect, useMemo, useState } from "react"
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useAuth } from "../context/AuthContext"
import { apiRequest } from "../services/http"
import { colors } from "../theme/tokens"

type SettlementListResponse = {
  success: boolean
  data: Array<{
    id: string
    status?: string
    calculation_details?: Record<string, unknown> | null
    loads?: unknown
  }>
}

type SettlementDetailsResponse = {
  success: boolean
  data: Record<string, unknown>
}

type ActiveLoad = {
  loadId: string | null
  origin: string
  destination: string
  pickupTime: string
  deliveryTime: string
  specialInstructions: string
  consigneeContact: string
}

function toText(value: unknown, fallback = "N/A"): string {
  const text = String(value ?? "").trim()
  return text.length ? text : fallback
}

function extractActiveLoadFromObject(input: Record<string, unknown>): ActiveLoad | null {
  const details = (input.calculation_details || input.details || input) as Record<string, unknown>
  const loadsCandidate = details.loads
  let loadObj: Record<string, unknown> | null = null

  if (Array.isArray(loadsCandidate) && loadsCandidate.length > 0) {
    const first = loadsCandidate[0]
    if (first && typeof first === "object") loadObj = first as Record<string, unknown>
  } else if (loadsCandidate && typeof loadsCandidate === "object") {
    loadObj = loadsCandidate as Record<string, unknown>
  }

  if (!loadObj) {
    const maybeLoad = details.load
    if (maybeLoad && typeof maybeLoad === "object") loadObj = maybeLoad as Record<string, unknown>
  }

  if (!loadObj) return null

  return {
    loadId: (loadObj.id as string | undefined) || (loadObj.load_id as string | undefined) || null,
    origin: toText(loadObj.origin),
    destination: toText(loadObj.destination),
    pickupTime: toText(loadObj.pickup_time || loadObj.load_date || loadObj.pickup_date),
    deliveryTime: toText(loadObj.delivery_time || loadObj.estimated_delivery || loadObj.delivery_date),
    specialInstructions: toText(loadObj.special_instructions || loadObj.notes || loadObj.instructions, "None"),
    consigneeContact: toText(
      loadObj.consignee_contact || loadObj.consignee_phone || loadObj.consignee_name || loadObj.receiver_contact,
      "Not available"
    ),
  }
}

export function CurrentLoadScreen() {
  const { sessionToken } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [load, setLoad] = useState<ActiveLoad | null>(null)

  const canFetch = useMemo(() => Boolean(sessionToken), [sessionToken])

  const fetchCurrentLoad = async () => {
    if (!sessionToken) return
    setLoading(true)
    setError(null)
    try {
      const list = await apiRequest<SettlementListResponse>("/api/mobile/settlements", sessionToken, "GET")
      const activeSettlement = list.data?.find((s) => String(s.status || "").toLowerCase() === "pending") || list.data?.[0]

      if (!activeSettlement) {
        setLoad(null)
        return
      }

      const details = await apiRequest<SettlementDetailsResponse>(
        `/api/mobile/settlements/${activeSettlement.id}`,
        sessionToken,
        "GET"
      )

      const extracted = extractActiveLoadFromObject(details.data || {})
      setLoad(extracted)
      if (!extracted) {
        setError("No active load details were found in settlement data.")
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load current assignment"
      setError(message)
      setLoad(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!canFetch) return
    void fetchCurrentLoad()
  }, [canFetch])

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Current Load</Text>
      <Text style={styles.subheader}>Latest active assignment from settlements</Text>

      {!sessionToken ? (
        <Text style={styles.muted}>Sign in to load current assignment details.</Text>
      ) : null}

      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {load ? (
        <View style={styles.card}>
          <Row label="Origin" value={load.origin} />
          <Row label="Destination" value={load.destination} />
          <Row label="Pickup Time" value={load.pickupTime} />
          <Row label="Delivery Time" value={load.deliveryTime} />
          <Row label="Special Instructions" value={load.specialInstructions} />
          <Row label="Consignee Contact" value={load.consigneeContact} />
        </View>
      ) : null}

      <Pressable style={styles.refreshButton} onPress={() => void fetchCurrentLoad()} disabled={!sessionToken || loading}>
        <Text style={styles.refreshButtonText}>{loading ? "Refreshing..." : "Refresh"}</Text>
      </Pressable>
    </ScrollView>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  header: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "700",
  },
  subheader: {
    color: colors.mutedText,
    fontSize: 13,
  },
  muted: {
    color: colors.mutedText,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  card: {
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 10,
  },
  row: {
    gap: 4,
  },
  label: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  value: {
    color: colors.text,
    fontSize: 15,
  },
  refreshButton: {
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  refreshButtonText: {
    color: colors.text,
    fontWeight: "700",
  },
})
