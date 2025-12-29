/**
 * Device Registration Screen
 * Register this mobile device as an ELD device
 */

import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { useELDDevice } from '../hooks/useELDDevice'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../App'

type DeviceRegistrationScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'DeviceRegistration'
>

export default function DeviceRegistrationScreen() {
  const navigation = useNavigation<DeviceRegistrationScreenNavigationProp>()
  const { register, isLoading, error } = useELDDevice()
  const [deviceName, setDeviceName] = useState('')
  const [truckId, setTruckId] = useState('')

  async function handleRegister() {
    if (!deviceName.trim()) {
      Alert.alert('Error', 'Please enter a device name')
      return
    }

    const success = await register(deviceName.trim(), truckId || undefined)

    if (success) {
      Alert.alert(
        'Success',
        'Device registered successfully!',
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigation will automatically switch to Home screen
            },
          },
        ]
      )
    } else {
      Alert.alert('Registration Failed', error || 'Failed to register device')
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Register Device</Text>
        <Text style={styles.subtitle}>
          Register this device as an ELD device for TruckMates
        </Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Device Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., John's iPhone"
          value={deviceName}
          onChangeText={setDeviceName}
          editable={!isLoading}
        />

        <Text style={styles.label}>Truck ID (Optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter truck ID if assigned"
          value={truckId}
          onChangeText={setTruckId}
          editable={!isLoading}
        />

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Register Device</Text>
          )}
        </TouchableOpacity>

        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>

      <View style={styles.info}>
        <Text style={styles.infoText}>
          This device will be registered with the TruckMates platform and will
          start tracking your hours of service and location data.
        </Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 24,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  form: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    marginBottom: 24,
    backgroundColor: '#f9f9f9',
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: '#FF3B30',
    marginTop: 8,
    fontSize: 14,
  },
  info: {
    backgroundColor: '#f0f0f0',
    padding: 16,
    borderRadius: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
})

