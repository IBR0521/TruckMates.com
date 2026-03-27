import React from "react"
import { ActivityIndicator, StyleSheet, View } from "react-native"
import { StatusBar } from "expo-status-bar"
import { AutoEldProvider } from "./src/context/AutoEldContext"
import { AuthProvider, useAuth } from "./src/context/AuthContext"
import { DvirProvider } from "./src/context/DvirContext"
import { EventProvider } from "./src/context/EventContext"
import { HosProvider } from "./src/context/HosContext"
import { UnassignedDrivingProvider } from "./src/context/UnassignedDrivingContext"
import { LoginScreen } from "./src/screens/LoginScreen"
import { AppShell } from "./src/navigation/AppShell"
import { colors } from "./src/theme/tokens"

function RootContent() {
  const { loading, sessionToken } = useAuth()
  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }
  return sessionToken ? <AppShell /> : <LoginScreen />
}

export default function App() {
  return (
    <AuthProvider>
      <HosProvider>
        <EventProvider>
          <UnassignedDrivingProvider>
            <AutoEldProvider>
              <DvirProvider>
                <StatusBar style="light" />
                <RootContent />
              </DvirProvider>
            </AutoEldProvider>
          </UnassignedDrivingProvider>
        </EventProvider>
      </HosProvider>
    </AuthProvider>
  )
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
})
