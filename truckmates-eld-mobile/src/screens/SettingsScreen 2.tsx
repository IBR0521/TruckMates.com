/**
 * Settings Screen
 * App preferences, account management, and configuration
 */

import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../App'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { authService, supabase } from '../services/api'
import { useELDDevice } from '../hooks/useELDDevice'
import { locationTrackingService } from '../services/locationTrackingService'
import { COLORS } from '../constants/colors'
import { APP_INFO } from '../constants/config'

type SettingsScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Settings'
>

export default function SettingsScreen() {
  const navigation = useNavigation<SettingsScreenNavigationProp>()
  const { deviceId, isRegistered } = useELDDevice()
  const [isLoading, setIsLoading] = useState(false)
  const [userEmail, setUserEmail] = useState<string>('')
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true)
  const [locationTrackingEnabled, setLocationTrackingEnabled] = useState(true)

  useEffect(() => {
    loadUserInfo()
    loadSettings()
  }, [])

  async function loadUserInfo() {
    try {
      const { user } = await authService.getUser()
      if (user?.email) {
        setUserEmail(user.email)
      }
    } catch (error) {
      console.error('Error loading user info:', error)
    }
  }

  async function loadSettings() {
    try {
      const notifications = await AsyncStorage.getItem('@eld/settings/notifications')
      const autoSync = await AsyncStorage.getItem('@eld/settings/auto_sync')
      const locationTracking = await AsyncStorage.getItem('@eld/settings/location_tracking')

      if (notifications !== null) {
        setNotificationsEnabled(JSON.parse(notifications))
      }
      if (autoSync !== null) {
        setAutoSyncEnabled(JSON.parse(autoSync))
      }
      if (locationTracking !== null) {
        setLocationTrackingEnabled(JSON.parse(locationTracking))
      }
    } catch (error) {
      console.error('Error loading settings:', error)
    }
  }

  async function handleNotificationsToggle(value: boolean) {
    setNotificationsEnabled(value)
    try {
      await AsyncStorage.setItem('@eld/settings/notifications', JSON.stringify(value))
    } catch (error) {
      console.error('Error saving notification settings:', error)
    }
  }

  async function handleAutoSyncToggle(value: boolean) {
    setAutoSyncEnabled(value)
    try {
      await AsyncStorage.setItem('@eld/settings/auto_sync', JSON.stringify(value))
    } catch (error) {
      console.error('Error saving auto-sync settings:', error)
    }
  }

  async function handleLocationTrackingToggle(value: boolean) {
    setLocationTrackingEnabled(value)
    try {
      await AsyncStorage.setItem('@eld/settings/location_tracking', JSON.stringify(value))
      
      if (!value && locationTrackingService.getTrackingStatus()) {
        locationTrackingService.stopTracking()
      } else if (value && isRegistered && deviceId && !locationTrackingService.getTrackingStatus()) {
        await locationTrackingService.startTracking(deviceId)
      }
    } catch (error) {
      console.error('Error saving location tracking settings:', error)
    }
  }

  async function handleLogout() {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true)
            try {
              // Stop location tracking
              locationTrackingService.stopTracking()
              
              // Clear device registration
              await AsyncStorage.removeItem('@eld/device_id')
              await AsyncStorage.removeItem('@eld/device_serial')
              
              // Sign out
              await authService.signOut()
              
              // Navigation will handle redirecting to login
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to log out')
            } finally {
              setIsLoading(false)
            }
          },
        },
      ]
    )
  }

  function handleClearCache() {
    Alert.alert(
      'Clear Cache',
      'This will clear all cached data. You will need to re-register your device. Continue?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear all AsyncStorage data
              await AsyncStorage.clear()
              Alert.alert('Success', 'Cache cleared successfully')
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to clear cache')
            }
          },
        },
      ]
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
        <Text style={styles.headerSubtitle}>App Preferences & Account</Text>
      </View>

      {/* Account Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Email</Text>
            <Text style={styles.settingValue}>{userEmail || 'Not available'}</Text>
          </View>
        </View>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Device Status</Text>
            <Text style={[styles.settingValue, { color: isRegistered ? COLORS.success : COLORS.destructive }]}>
              {isRegistered ? 'Registered' : 'Not Registered'}
            </Text>
          </View>
        </View>
        {deviceId && (
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Device ID</Text>
              <Text style={[styles.settingValue, styles.deviceId]} numberOfLines={1}>
                {deviceId}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Preferences Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Notifications</Text>
            <Text style={styles.settingDescription}>Receive alerts and reminders</Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={handleNotificationsToggle}
            trackColor={{ false: COLORS.border, true: COLORS.primary }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Auto Sync</Text>
            <Text style={styles.settingDescription}>Automatically sync data to TruckMates</Text>
          </View>
          <Switch
            value={autoSyncEnabled}
            onValueChange={handleAutoSyncToggle}
            trackColor={{ false: COLORS.border, true: COLORS.primary }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Location Tracking</Text>
            <Text style={styles.settingDescription}>Track GPS location continuously</Text>
          </View>
          <Switch
            value={locationTrackingEnabled && isRegistered}
            onValueChange={handleLocationTrackingToggle}
            disabled={!isRegistered}
            trackColor={{ false: COLORS.border, true: COLORS.primary }}
            thumbColor="#FFFFFF"
          />
        </View>
        {!isRegistered && (
          <Text style={styles.disabledText}>
            Register device to enable location tracking
          </Text>
        )}
      </View>

      {/* Data Management Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data Management</Text>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('Settlements')}
        >
          <Text style={styles.actionButtonText}>Settlements</Text>
          <Text style={styles.actionButtonDescription}>
            View and approve your pay statements
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleClearCache}
        >
          <Text style={styles.actionButtonText}>Clear Cache</Text>
          <Text style={styles.actionButtonDescription}>
            Remove all cached data and logs
          </Text>
        </TouchableOpacity>
      </View>

      {/* About Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>App Name</Text>
            <Text style={styles.settingValue}>{APP_INFO.NAME}</Text>
          </View>
        </View>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Version</Text>
            <Text style={styles.settingValue}>{APP_INFO.VERSION}</Text>
          </View>
        </View>
      </View>

      {/* Logout Button */}
      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.logoutButton, isLoading && styles.logoutButtonDisabled]}
          onPress={handleLogout}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.logoutButtonText}>Log Out</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  header: {
    backgroundColor: COLORS.card,
    padding: 20,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.foreground,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.mutedForeground,
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.foreground,
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.foreground,
    marginBottom: 4,
  },
  settingValue: {
    fontSize: 14,
    color: COLORS.mutedForeground,
  },
  deviceId: {
    fontFamily: 'monospace',
    fontSize: 12,
  },
  settingDescription: {
    fontSize: 12,
    color: COLORS.mutedForeground,
    marginTop: 2,
  },
  disabledText: {
    fontSize: 12,
    color: COLORS.mutedForeground,
    fontStyle: 'italic',
    marginTop: 8,
  },
  actionButton: {
    padding: 16,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.foreground,
    marginBottom: 4,
  },
  actionButtonDescription: {
    fontSize: 12,
    color: COLORS.mutedForeground,
  },
  logoutButton: {
    backgroundColor: COLORS.destructive,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  logoutButtonDisabled: {
    opacity: 0.5,
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
})

