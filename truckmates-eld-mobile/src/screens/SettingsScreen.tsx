import React, { useEffect, useState } from "react"
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { useAuth } from "../context/AuthContext"
import { flushQueue, getQueueStats } from "../services/sync-queue"
import { colors } from "../theme/tokens"

const SYNC_TIMEOUT_MS = 30000

export function SettingsScreen() {
  const { signOut, sessionToken, deviceId, assignedTruckId, setAssignedTruckId } = useAuth()
  const [truck, setTruck] = useState(assignedTruckId || "")
  const [stats, setStats] = useState({ totalItems: 0, locations: 0, logs: 0, events: 0, dvirs: 0 })
  const [syncing, setSyncing] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null)

  async function refreshStats() {
    setRefreshing(true)
    try {
      const next = await getQueueStats()
      setStats(next)
      setLastRefreshedAt(new Date().toLocaleTimeString())
    } catch (e) {
      Alert.alert("Refresh failed", e instanceof Error ? e.message : "Unable to refresh sync stats")
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void refreshStats()
  }, [])

  async function saveTruck() {
    await setAssignedTruckId(truck)
    Alert.alert("Saved", "Assigned truck ID updated.")
  }

  async function flushPending() {
    if (!sessionToken || !deviceId) {
      Alert.alert("Sync unavailable", "Log in and register device first.")
      return
    }
    setSyncing(true)
    try {
      await Promise.race([
        flushQueue(sessionToken, deviceId),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Sync timeout after ${Math.round(SYNC_TIMEOUT_MS / 1000)}s`)),
            SYNC_TIMEOUT_MS
          )
        ),
      ])
      await refreshStats()
      Alert.alert("Sync complete", "Pending queue flushed.")
    } catch (e) {
      Alert.alert("Sync failed", e instanceof Error ? e.message : "Unknown error")
    } finally {
      setSyncing(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.item}>Registered Device ID:</Text>
      <Text style={styles.value}>{deviceId || "Not registered"}</Text>
      <Text style={styles.item}>Assigned Truck ID:</Text>
      <TextInput
        value={truck}
        onChangeText={setTruck}
        placeholder="Enter truck ID"
        placeholderTextColor={colors.mutedText}
        style={styles.input}
      />
      <Pressable style={styles.save} onPress={() => void saveTruck()}>
        <Text style={styles.saveText}>Save Truck Assignment</Text>
      </Pressable>

      <View style={styles.syncPanel}>
        <Text style={styles.item}>Sync Health</Text>
        <Text style={styles.value}>
          Last refresh: {lastRefreshedAt || "Not yet"}
        </Text>
        <Text style={styles.value}>Queue items: {stats.totalItems}</Text>
        <Text style={styles.value}>Locations: {stats.locations}</Text>
        <Text style={styles.value}>Logs: {stats.logs}</Text>
        <Text style={styles.value}>Events: {stats.events}</Text>
        <Text style={styles.value}>DVIRs: {stats.dvirs}</Text>
        <View style={styles.syncActions}>
          <Pressable style={styles.refreshButton} onPress={() => void refreshStats()} disabled={refreshing}>
            <Text style={styles.saveText}>{refreshing ? "Refreshing..." : "Refresh"}</Text>
          </Pressable>
          <Pressable style={styles.flushButton} onPress={() => void flushPending()} disabled={syncing || refreshing}>
            <Text style={styles.saveText}>{syncing ? "Syncing..." : "Flush Now"}</Text>
          </Pressable>
        </View>
      </View>

      <Pressable style={styles.signOut} onPress={() => void signOut()}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20, gap: 10 },
  title: { color: colors.text, fontSize: 22, fontWeight: "700", marginBottom: 8 },
  item: { color: colors.mutedText, fontSize: 13 },
  value: { color: colors.text, fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  save: {
    borderRadius: 10,
    backgroundColor: colors.primary,
    padding: 12,
    alignItems: "center",
  },
  saveText: { color: colors.text, fontWeight: "700" },
  syncPanel: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 10,
    gap: 4,
  },
  syncActions: { flexDirection: "row", gap: 8, marginTop: 6 },
  refreshButton: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: colors.primary,
    padding: 10,
    alignItems: "center",
  },
  flushButton: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: colors.success,
    padding: 10,
    alignItems: "center",
  },
  signOut: {
    marginTop: 16,
    borderRadius: 10,
    backgroundColor: colors.danger,
    padding: 12,
    alignItems: "center",
  },
  signOutText: { color: colors.text, fontWeight: "700" },
})
