import React, { useMemo, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { DotInspectionScreen } from "../screens/DotInspectionScreen"
import { DriverHomeScreen } from "../screens/DriverHomeScreen"
import { HosScreen } from "../screens/HosScreen"
import { DvirScreen } from "../screens/DvirScreen"
import { SettingsScreen } from "../screens/SettingsScreen"
import { ViolationsScreen } from "../screens/ViolationsScreen"
import { colors } from "../theme/tokens"

type TabKey = "home" | "hos" | "dvir" | "alerts" | "dot" | "settings"

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "home", label: "Home" },
  { key: "hos", label: "HOS" },
  { key: "dvir", label: "DVIR" },
  { key: "alerts", label: "Alerts" },
  { key: "dot", label: "DOT" },
  { key: "settings", label: "Settings" },
]

export function AppShell() {
  const [tab, setTab] = useState<TabKey>("home")

  const screen = useMemo(() => {
    if (tab === "home") return <DriverHomeScreen />
    if (tab === "hos") return <HosScreen />
    if (tab === "dvir") return <DvirScreen />
    if (tab === "alerts") return <ViolationsScreen />
    if (tab === "dot") return <DotInspectionScreen />
    return <SettingsScreen />
  }, [tab])

  return (
    <View style={styles.container}>
      <View style={styles.content}>{screen}</View>
      <View style={styles.tabs}>
        {tabs.map((item) => (
          <Pressable key={item.key} onPress={() => setTab(item.key)} style={styles.tabButton}>
            <Text style={[styles.tabText, tab === item.key && styles.tabTextActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1 },
  tabs: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabButton: { flex: 1, alignItems: "center", paddingVertical: 12 },
  tabText: { color: colors.mutedText, fontWeight: "600", fontSize: 11 },
  tabTextActive: { color: colors.primary },
})
