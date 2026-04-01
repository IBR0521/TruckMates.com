import React, { useMemo, useState } from "react"
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { DotInspectionScreen } from "../screens/DOTInspectionScreen"
import { DriverHomeScreen } from "../screens/DriverHomeScreen"
import { HosScreen } from "../screens/HosScreen"
import { DvirScreen } from "../screens/DVIRScreen"
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
          {tabs.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => setTab(item.key)}
              style={({ pressed }) => [styles.tabButton, tab === item.key && styles.tabButtonActive, pressed && styles.tabButtonPressed]}
            >
              <Text style={[styles.tabText, tab === item.key && styles.tabTextActive]} numberOfLines={1}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1 },
  tabs: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tabsScroll: {
    gap: 8,
    paddingRight: 10,
  },
  tabButton: {
    minWidth: 84,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  tabButtonActive: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  tabText: { color: colors.mutedText, fontWeight: "700", fontSize: 11, letterSpacing: 0.2 },
  tabTextActive: { color: colors.text },
  tabButtonPressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
})
