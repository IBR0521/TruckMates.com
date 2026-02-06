/**
 * Main App Component
 * TruckMates ELD Mobile App
 * Professional ELD app with bottom navigation
 */

// Import URL polyfill for React Native compatibility (must be first)
import 'react-native-url-polyfill/auto'

import React, { useEffect, useState } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { StatusBar, View, ActivityIndicator, Text, StyleSheet } from 'react-native'
import { PaperProvider } from 'react-native-paper'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { authService, supabase } from './services/api'
import { useELDDevice } from './hooks/useELDDevice'
import { locationTrackingService } from './services/locationTrackingService'
import { COLORS } from './constants/colors'

// Screens
import LoginScreen from './screens/LoginScreen'
import DeviceRegistrationScreen from './screens/DeviceRegistrationScreen'
import HomeScreen from './screens/HomeScreen'
import StatusScreen from './screens/StatusScreen'
import LogsScreen from './screens/LogsScreen'
import LocationScreen from './screens/LocationScreen'
import DVIRScreen from './screens/DVIRScreen'
import SettingsScreen from './screens/SettingsScreen'
import DOTInspectionScreen from './screens/DOTInspectionScreen'
import SettlementsScreen from './screens/SettlementsScreen'

export type RootStackParamList = {
  Login: undefined
  DeviceRegistration: undefined
  MainTabs: undefined
  Settings: undefined
  DOTInspection: undefined
  Settlements: undefined
}

export type MainTabParamList = {
  Home: undefined
  Status: undefined
  Logs: undefined
  Location: undefined
  DVIR: undefined
}

const Stack = createNativeStackNavigator<RootStackParamList>()
const Tab = createBottomTabNavigator<MainTabParamList>()

function MainTabsNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.mutedForeground,
        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopWidth: 1,
          borderTopColor: COLORS.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        lazy: true, // Load screens on demand for better performance
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color }) => (
            <View style={styles.iconContainer}>
              <Text style={[styles.iconText, { color }]}>H</Text>
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Status"
        component={StatusScreen}
        options={{
          tabBarLabel: 'Status',
          tabBarIcon: ({ color }) => (
            <View style={styles.iconContainer}>
              <Text style={[styles.iconText, { color }]}>S</Text>
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Logs"
        component={LogsScreen}
        options={{
          tabBarLabel: 'Logs',
          tabBarIcon: ({ color }) => (
            <View style={styles.iconContainer}>
              <Text style={[styles.iconText, { color }]}>L</Text>
            </View>
          ),
        }}
      />
          <Tab.Screen
            name="Location"
            component={LocationScreen}
            options={{
              tabBarLabel: 'Location',
              tabBarIcon: ({ color }) => (
                <View style={styles.iconContainer}>
                  <Text style={[styles.iconText, { color }]}>G</Text>
                </View>
              ),
            }}
          />
          <Tab.Screen
            name="DVIR"
            component={DVIRScreen}
            options={{
              tabBarLabel: 'DVIR',
              tabBarIcon: ({ color }) => (
                <View style={styles.iconContainer}>
                  <Text style={[styles.iconText, { color }]}>D</Text>
                </View>
              ),
            }}
          />
        </Tab.Navigator>
  )
}

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

  // Start continuous location tracking when device is registered
  useEffect(() => {
    if (isRegistered && deviceId) {
      console.log('ELD Device registered - Starting continuous location tracking for device:', deviceId)
      locationTrackingService.startTracking(deviceId).then((started) => {
        if (started) {
          console.log('✓ Location tracking started successfully')
        } else {
          console.warn('⚠ Location tracking failed to start - check permissions')
        }
      })
    } else {
      // Stop tracking if device is not registered
      console.log('ELD Device not registered - Location tracking inactive')
      locationTrackingService.stopTracking()
    }

    return () => {
      // Don't stop tracking on unmount - let it run continuously
      // Only stop if device is unregistered
      if (!isRegistered || !deviceId) {
        locationTrackingService.stopTracking()
      }
    }
  }, [isRegistered, deviceId])

  if (isLoading) {
    return (
      <SafeAreaProvider>
        <PaperProvider>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading TruckMates ELD...</Text>
          </View>
        </PaperProvider>
      </SafeAreaProvider>
    )
  }

  return (
    <SafeAreaProvider>
      <PaperProvider>
        <NavigationContainer>
          <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: COLORS.background },
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
                    <Stack.Screen name="MainTabs" component={MainTabsNavigator} />
                    <Stack.Screen 
                      name="Settlements" 
                      component={SettlementsScreen}
                      options={{
                        headerShown: true,
                        title: 'Settlements',
                        headerStyle: {
                          backgroundColor: COLORS.card,
                        },
                        headerTintColor: COLORS.foreground,
                      }}
                    />
                    <Stack.Screen 
                      name="Settings" 
                      component={SettingsScreen}
                      options={{
                        headerShown: true,
                        title: 'Settings',
                        headerStyle: {
                          backgroundColor: COLORS.card,
                        },
                        headerTintColor: COLORS.foreground,
                      }}
                    />
                    <Stack.Screen 
                      name="DOTInspection" 
                      component={DOTInspectionScreen}
                      options={{
                        headerShown: true,
                        title: 'DOT Inspection',
                        headerStyle: {
                          backgroundColor: COLORS.card,
                        },
                        headerTintColor: COLORS.foreground,
                      }}
                    />
                  </>
                )}
              </Stack.Navigator>
        </NavigationContainer>
      </PaperProvider>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.foreground,
  },
  iconContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
})

export default App
