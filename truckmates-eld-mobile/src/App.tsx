/**
 * Main App Component
 * TruckMates ELD Mobile App
 */

// Import URL polyfill for React Native compatibility (must be first)
import 'react-native-url-polyfill/auto'

import React, { useEffect, useState } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { StatusBar, View, ActivityIndicator, Text } from 'react-native'
import { PaperProvider } from 'react-native-paper'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { authService, supabase } from './services/api'
import { useELDDevice } from './hooks/useELDDevice'

// Screens
import LoginScreen from './screens/LoginScreen'
import DeviceRegistrationScreen from './screens/DeviceRegistrationScreen'
import HomeScreen from './screens/HomeScreen'
import StatusScreen from './screens/StatusScreen'
import LogsScreen from './screens/LogsScreen'

export type RootStackParamList = {
  Login: undefined
  DeviceRegistration: undefined
  Home: undefined
  Status: undefined
  Logs: undefined
}

const Stack = createNativeStackNavigator<RootStackParamList>()

function App(): JSX.Element {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { deviceId, isRegistered } = useELDDevice()

  async function checkAuth() {
    try {
      if (!authService) {
        console.error('authService is not available')
        setIsAuthenticated(false)
        setIsLoading(false)
        return
      }
      const { session } = await authService.getSession()
      setIsAuthenticated(!!session)
    } catch (error) {
      console.error('Auth check error:', error)
      setIsAuthenticated(false)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    // Initial auth check
    checkAuth()

    // Listen for auth state changes (login, logout, etc.)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session)
      setIsLoading(false)
    })

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe()
    }
  }, [])

  if (isLoading) {
    return (
      <SafeAreaProvider>
        <PaperProvider>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={{ marginTop: 10 }}>Loading...</Text>
          </View>
        </PaperProvider>
      </SafeAreaProvider>
    )
  }

  return (
    <SafeAreaProvider>
      <PaperProvider>
        <NavigationContainer>
          <StatusBar barStyle="dark-content" />
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
            }}
          >
            {!isAuthenticated ? (
              <Stack.Screen name="Login" component={LoginScreen} />
            ) : !isRegistered ? (
              <Stack.Screen
                name="DeviceRegistration"
                component={DeviceRegistrationScreen}
              />
            ) : (
              <>
                <Stack.Screen name="Home" component={HomeScreen} />
                <Stack.Screen name="Status" component={StatusScreen} />
                <Stack.Screen name="Logs" component={LogsScreen} />
              </>
            )}
          </Stack.Navigator>
        </NavigationContainer>
      </PaperProvider>
    </SafeAreaProvider>
  )
}

export default App

