import React, { useMemo, useState } from "react"
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { colors } from "../theme/tokens"

function encodeAddress(value: string) {
  return encodeURIComponent(value.trim())
}

export function NavigationScreen() {
  const [origin, setOrigin] = useState("")
  const [destination, setDestination] = useState("")

  const canNavigate = useMemo(() => origin.trim().length > 0 && destination.trim().length > 0, [origin, destination])

  const openNavigation = async () => {
    if (!canNavigate) {
      Alert.alert("Missing addresses", "Please fill origin and destination.")
      return
    }

    const o = encodeAddress(origin)
    const d = encodeAddress(destination)

    const googleAppUrl = `comgooglemaps://?saddr=${o}&daddr=${d}&directionsmode=driving`
    const appleMapsUrl = `maps://?saddr=${o}&daddr=${d}`
    const browserUrl = `https://www.google.com/maps/dir/?api=1&origin=${o}&destination=${d}&travelmode=driving`

    try {
      const canOpenGoogle = await Linking.canOpenURL("comgooglemaps://")
      if (canOpenGoogle) {
        await Linking.openURL(googleAppUrl)
        return
      }

      const canOpenApple = await Linking.canOpenURL("maps://")
      if (canOpenApple) {
        await Linking.openURL(appleMapsUrl)
        return
      }

      await Linking.openURL(browserUrl)
    } catch (e) {
      Alert.alert("Navigation failed", e instanceof Error ? e.message : "Unable to open map app")
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Navigation</Text>
      <Text style={styles.subheader}>
        Open turn-by-turn navigation via Google Maps app, Apple Maps fallback, then browser fallback.
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>Origin</Text>
        <TextInput
          value={origin}
          onChangeText={setOrigin}
          placeholder="Pickup address"
          placeholderTextColor={colors.mutedText}
          style={styles.input}
        />
        <Text style={styles.label}>Destination</Text>
        <TextInput
          value={destination}
          onChangeText={setDestination}
          placeholder="Delivery address"
          placeholderTextColor={colors.mutedText}
          style={styles.input}
        />
      </View>

      <Pressable style={[styles.navigateButton, !canNavigate && styles.disabled]} onPress={() => void openNavigation()}>
        <Text style={styles.navigateText}>Navigate</Text>
      </Pressable>
    </ScrollView>
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
  card: {
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 8,
  },
  label: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.35,
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    color: colors.text,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 8,
  },
  navigateButton: {
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
  },
  navigateText: {
    color: colors.text,
    fontWeight: "700",
  },
  disabled: {
    opacity: 0.6,
  },
})
