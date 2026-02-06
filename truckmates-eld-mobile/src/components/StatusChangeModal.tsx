/**
 * Status Change Modal
 * Professional ELD app pattern - requires location and odometer entry
 */

import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { getCurrentLocation } from '../services/locationService'
import { COLORS } from '../constants/colors'
import type { LogType, Location } from '../types'

interface StatusChangeModalProps {
  visible: boolean
  currentStatus: LogType
  onClose: () => void
  onConfirm: (newStatus: LogType, location: { lat: number; lng: number }, odometer: number, notes?: string) => Promise<void>
}

const STATUS_OPTIONS: { value: LogType; label: string; color: string }[] = [
  { value: 'driving', label: 'DRIVING', color: COLORS.destructive },
  { value: 'on_duty', label: 'ON DUTY', color: '#FF9500' },
  { value: 'off_duty', label: 'OFF DUTY', color: COLORS.success },
  { value: 'sleeper_berth', label: 'SLEEPER BERTH', color: '#007AFF' },
  { value: 'personal_conveyance', label: 'PERSONAL CONVEYANCE', color: '#9B59B6' },
  { value: 'yard_moves', label: 'YARD MOVES', color: '#3498DB' },
]

export default function StatusChangeModal({
  visible,
  currentStatus,
  onClose,
  onConfirm,
}: StatusChangeModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<LogType>(currentStatus)
  const [location, setLocation] = useState<Location | null>(null)
  const [odometer, setOdometer] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [manualLat, setManualLat] = useState<string>('')
  const [manualLng, setManualLng] = useState<string>('')
  const [useManualLocation, setUseManualLocation] = useState(false)

  useEffect(() => {
    if (visible) {
      setSelectedStatus(currentStatus)
      setOdometer('')
      setNotes('')
      loadLocation()
    }
  }, [visible, currentStatus])

  async function loadLocation() {
    setIsGettingLocation(true)
    try {
      const loc = await getCurrentLocation()
      if (loc) {
        setLocation(loc)
      } else {
        Alert.alert('Location Error', 'Unable to get current location. Please enter manually.')
      }
    } catch (error) {
      console.error('Error getting location:', error)
      Alert.alert('Location Error', 'Unable to get current location. Please enter manually.')
    } finally {
      setIsGettingLocation(false)
    }
  }

  async function handleConfirm() {
    // Determine location to use
    let finalLocation: { lat: number; lng: number } | null = null

    if (useManualLocation && manualLat && manualLng) {
      const lat = parseFloat(manualLat.trim())
      const lng = parseFloat(manualLng.trim())
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        finalLocation = { lat, lng }
      }
    } else if (location) {
      finalLocation = { lat: location.latitude, lng: location.longitude }
    }

    // Validation
    if (!finalLocation) {
      Alert.alert('Location Required', 'Please wait for location to load or enter coordinates manually.')
      return
    }

    const odometerValue = parseFloat(odometer.trim())
    if (!odometer.trim() || isNaN(odometerValue) || odometerValue < 0) {
      Alert.alert('Invalid Odometer', 'Please enter a valid odometer reading.')
      return
    }

    if (selectedStatus === currentStatus) {
      Alert.alert('Same Status', 'Please select a different status.')
      return
    }

    setIsLoading(true)
    try {
      await onConfirm(
        selectedStatus,
        finalLocation,
        odometerValue,
        notes.trim() || undefined
      )
      onClose()
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to change status')
    } finally {
      setIsLoading(false)
    }
  }

  function formatCoordinates(lat: number, lng: number): string {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
  }

  function hasValidLocation(): boolean {
    if (useManualLocation) {
      const lat = parseFloat(manualLat.trim())
      const lng = parseFloat(manualLng.trim())
      return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
    }
    return location !== null
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalContainer}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Change Status</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {/* Status Selection */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Select New Status</Text>
                <View style={styles.statusGrid}>
                  {STATUS_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.statusOption,
                        selectedStatus === option.value && {
                          backgroundColor: option.color,
                          borderColor: option.color,
                        },
                        selectedStatus === option.value && styles.statusOptionActive,
                      ]}
                      onPress={() => setSelectedStatus(option.value)}
                      disabled={option.value === currentStatus}
                    >
                      <Text
                        style={[
                          styles.statusOptionText,
                          selectedStatus === option.value && styles.statusOptionTextActive,
                          option.value === currentStatus && styles.statusOptionDisabled,
                        ]}
                      >
                        {option.label}
                      </Text>
                      {option.value === currentStatus && (
                        <Text style={styles.currentLabel}>(Current)</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Location */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Location</Text>
                {!useManualLocation ? (
                  <>
                    {isGettingLocation ? (
                      <View style={styles.locationLoading}>
                        <Text style={styles.loadingText}>Getting location...</Text>
                      </View>
                    ) : location ? (
                      <View style={styles.locationDisplay}>
                        <Text style={styles.locationText} selectable>
                          {formatCoordinates(location.latitude, location.longitude)}
                        </Text>
                        {location.address && (
                          <Text style={styles.addressText}>{location.address}</Text>
                        )}
                        <View style={styles.locationActions}>
                          <TouchableOpacity
                            style={styles.refreshLocationButton}
                            onPress={loadLocation}
                          >
                            <Text style={styles.refreshLocationText}>Refresh</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.manualLocationButton}
                            onPress={() => setUseManualLocation(true)}
                          >
                            <Text style={styles.manualLocationText}>Enter Manually</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.locationError}>
                        <Text style={styles.errorText}>Location not available</Text>
                        <View style={styles.locationActions}>
                          <TouchableOpacity
                            style={styles.refreshLocationButton}
                            onPress={loadLocation}
                          >
                            <Text style={styles.refreshLocationText}>Try Again</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.manualLocationButton}
                            onPress={() => setUseManualLocation(true)}
                          >
                            <Text style={styles.manualLocationText}>Enter Manually</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </>
                ) : (
                  <View style={styles.manualLocationContainer}>
                    <View style={styles.manualLocationRow}>
                      <View style={styles.manualLocationInputContainer}>
                        <Text style={styles.manualLocationLabel}>Latitude</Text>
                        <TextInput
                          style={styles.input}
                          value={manualLat}
                          onChangeText={setManualLat}
                          placeholder="e.g., 37.7749"
                          placeholderTextColor={COLORS.mutedForeground}
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={styles.manualLocationInputContainer}>
                        <Text style={styles.manualLocationLabel}>Longitude</Text>
                        <TextInput
                          style={styles.input}
                          value={manualLng}
                          onChangeText={setManualLng}
                          placeholder="e.g., -122.4194"
                          placeholderTextColor={COLORS.mutedForeground}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.useAutoLocationButton}
                      onPress={() => {
                        setUseManualLocation(false)
                        loadLocation()
                      }}
                    >
                      <Text style={styles.useAutoLocationText}>Use Auto Location</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Odometer */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Odometer Reading *</Text>
                <TextInput
                  style={styles.input}
                  value={odometer}
                  onChangeText={setOdometer}
                  placeholder="Enter odometer reading"
                  placeholderTextColor={COLORS.mutedForeground}
                  keyboardType="numeric"
                  autoCapitalize="none"
                />
              </View>

              {/* Notes (Optional) */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Notes (Optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Add any notes about this status change..."
                  placeholderTextColor={COLORS.mutedForeground}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            </ScrollView>

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={onClose}
                disabled={isLoading}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.confirmButton,
                  (!hasValidLocation() || !odometer.trim() || isLoading) && styles.buttonDisabled,
                ]}
                onPress={handleConfirm}
                disabled={!hasValidLocation() || !odometer.trim() || isLoading}
              >
                <Text style={styles.confirmButtonText}>
                  {isLoading ? 'Changing...' : 'Confirm Change'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.foreground,
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: COLORS.mutedForeground,
  },
  scrollContent: {
    flex: 1,
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.foreground,
    marginBottom: 12,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statusOption: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusOptionActive: {
    borderWidth: 3,
  },
  statusOptionText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.foreground,
    textAlign: 'center',
  },
  statusOptionTextActive: {
    color: '#FFFFFF',
  },
  statusOptionDisabled: {
    opacity: 0.5,
  },
  currentLabel: {
    fontSize: 10,
    color: COLORS.mutedForeground,
    marginTop: 4,
  },
  locationLoading: {
    padding: 16,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.mutedForeground,
    fontSize: 14,
  },
  locationDisplay: {
    padding: 16,
    backgroundColor: COLORS.background,
    borderRadius: 8,
  },
  locationText: {
    fontSize: 16,
    color: COLORS.foreground,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 12,
    color: COLORS.mutedForeground,
    marginBottom: 8,
  },
  locationError: {
    padding: 16,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    alignItems: 'center',
  },
  errorText: {
    color: COLORS.destructive,
    fontSize: 14,
    marginBottom: 8,
  },
  refreshLocationButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    marginTop: 8,
  },
  refreshLocationText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: COLORS.foreground,
  },
  textArea: {
    minHeight: 80,
    paddingTop: 12,
  },
  actions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelButtonText: {
    color: COLORS.foreground,
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: COLORS.primary,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  locationActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  manualLocationButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: COLORS.secondary,
    borderRadius: 8,
    flex: 1,
  },
  manualLocationText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  manualLocationContainer: {
    padding: 16,
    backgroundColor: COLORS.background,
    borderRadius: 8,
  },
  manualLocationRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  manualLocationInputContainer: {
    flex: 1,
  },
  manualLocationLabel: {
    fontSize: 12,
    color: COLORS.mutedForeground,
    marginBottom: 4,
  },
  useAutoLocationButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  useAutoLocationText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
})

