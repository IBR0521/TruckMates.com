/**
 * DVIR Screen - Daily Vehicle Inspection Report
 * Professional ELD app pattern - Pre/Post trip inspections with defect tracking
 */

import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getCurrentLocation } from '../services/locationService'
import { useELDDevice } from '../hooks/useELDDevice'
import { queueDVIR, syncAllQueues } from '../services/syncService'
import { COLORS } from '../constants/colors'
import type { InspectionType, DVIR, DVIRDefect, DefectSeverity, Location } from '../types'
import { format } from 'date-fns'

// Standard inspection components (FMCSA requirements)
const INSPECTION_COMPONENTS = [
  'Brakes',
  'Lights',
  'Tires',
  'Steering',
  'Suspension',
  'Engine',
  'Transmission',
  'Exhaust',
  'Mirrors',
  'Windshield',
  'Wipers',
  'Horn',
  'Fuel System',
  'Electrical',
  'Other',
]

const DEFECT_SEVERITIES: { value: DefectSeverity; label: string; color: string }[] = [
  { value: 'minor', label: 'Minor', color: '#FF9500' },
  { value: 'major', label: 'Major', color: '#FF3B30' },
  { value: 'critical', label: 'Critical', color: COLORS.destructive },
]

export default function DVIRScreen() {
  const { deviceId, isRegistered } = useELDDevice()
  const [inspectionType, setInspectionType] = useState<InspectionType>('pre_trip')
  const [location, setLocation] = useState<Location | null>(null)
  const [odometer, setOdometer] = useState<string>('')
  const [defectsFound, setDefectsFound] = useState(false)
  const [safeToOperate, setSafeToOperate] = useState(true)
  const [defects, setDefects] = useState<DVIRDefect[]>([])
  const [notes, setNotes] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [recentInspections, setRecentInspections] = useState<DVIR[]>([])
  const [componentStatuses, setComponentStatuses] = useState<Record<string, 'ok' | 'defective' | null>>({})

  useFocusEffect(
    React.useCallback(() => {
      loadLocation()
      loadRecentInspections()
    }, [])
  )

  async function loadLocation() {
    try {
      const loc = await getCurrentLocation()
      if (loc) {
        setLocation(loc)
      }
    } catch (error) {
      console.error('Error loading location:', error)
    }
  }

  async function loadRecentInspections() {
    try {
      const stored = await AsyncStorage.getItem('@eld/recent_dvirs')
      if (stored) {
        const parsed = JSON.parse(stored)
        setRecentInspections(parsed.slice(0, 10)) // Last 10 inspections
      }
    } catch (error) {
      console.error('Error loading inspections:', error)
    }
  }

  function handleAddDefect() {
    setDefects([
      ...defects,
      {
        component: '',
        description: '',
        severity: 'minor',
        corrected: false,
      },
    ])
    setDefectsFound(true)
  }

  function handleRemoveDefect(index: number) {
    const updated = defects.filter((_, i) => i !== index)
    setDefects(updated)
    if (updated.length === 0) {
      setDefectsFound(false)
    }
  }

  function handleDefectChange(index: number, field: keyof DVIRDefect, value: any) {
    const updated = [...defects]
    updated[index] = { ...updated[index], [field]: value }
    setDefects(updated)
  }

  async function handleSubmit() {
    // Validation
    if (!deviceId || !isRegistered) {
      Alert.alert('Error', 'ELD device must be registered to submit DVIR')
      return
    }

    const odometerValue = parseFloat(odometer)
    if (isNaN(odometerValue) || odometerValue < 0) {
      Alert.alert('Invalid Odometer', 'Please enter a valid odometer reading.')
      return
    }

    // Pre-trip validation: All components must be checked
    if (inspectionType === 'pre_trip') {
      const allChecked = INSPECTION_COMPONENTS.every(comp => 
        componentStatuses[comp] === 'ok' || componentStatuses[comp] === 'defective'
      )
      if (!allChecked) {
        Alert.alert(
          'Incomplete Inspection',
          'Pre-trip inspection requires checking all components. Please review all items.'
        )
        return
      }
    }
    
    // Post-trip: Only defects need to be reported
    if (inspectionType === 'post_trip' && defectsFound && defects.length === 0) {
      Alert.alert(
        'Defects Required',
        'Post-trip inspection requires reporting any defects found. If no defects, uncheck "Defects Found".'
      )
      return
    }

    if (defectsFound && defects.length === 0) {
      Alert.alert('Defects Required', 'Please add at least one defect or mark as no defects found.')
      return
    }

    if (defectsFound) {
      for (const defect of defects) {
        if (!defect.component || !defect.description) {
          Alert.alert('Incomplete Defect', 'Please fill in all defect fields.')
          return
        }
      }
    }

    setIsSubmitting(true)
    try {
      const now = new Date()
      const dvir: DVIR = {
        truck_id: deviceId, // Using deviceId as truck_id for now
        inspection_type: inspectionType,
        inspection_date: format(now, 'yyyy-MM-dd'),
        inspection_time: format(now, 'HH:mm'),
        location: location
          ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`
          : undefined,
        odometer_reading: odometerValue,
        status: defectsFound ? (defects.every((d) => d.corrected) ? 'defects_corrected' : 'failed') : 'passed',
        defects_found: defectsFound,
        safe_to_operate: safeToOperate,
        defects: defectsFound && defects.length > 0 ? defects : undefined,
        notes: notes.trim() || undefined,
        driver_signature_date: now.toISOString(),
      }

      // Save locally
      const stored = await AsyncStorage.getItem('@eld/recent_dvirs')
      const existing = stored ? JSON.parse(stored) : []
      const updated = [dvir, ...existing].slice(0, 50) // Keep last 50
      await AsyncStorage.setItem('@eld/recent_dvirs', JSON.stringify(updated))

      // Queue for sync to TruckMates platform
      await queueDVIR(deviceId, dvir)
      
      // Try to sync immediately
      try {
        await syncAllQueues(deviceId)
      } catch (error) {
        console.error('Error syncing DVIR:', error)
        // Will sync later automatically
      }

      Alert.alert(
        'DVIR Submitted',
        `${inspectionType === 'pre_trip' ? 'Pre-trip' : 'Post-trip'} inspection submitted successfully.`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Reset form
              setDefects([])
              setDefectsFound(false)
              setSafeToOperate(true)
              setNotes('')
              setOdometer('')
              loadRecentInspections()
            },
          },
        ]
      )
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit DVIR')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Vehicle Inspection</Text>
        <Text style={styles.headerSubtitle}>Daily Vehicle Inspection Report (DVIR)</Text>
      </View>

      {/* Inspection Type Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Inspection Type</Text>
        <View style={styles.typeSelector}>
          <TouchableOpacity
            style={[
              styles.typeButton,
              inspectionType === 'pre_trip' && styles.typeButtonActive,
            ]}
            onPress={() => {
              setInspectionType('pre_trip')
              setDefects([])
              setDefectsFound(false)
              setComponentStatuses({}) // Reset component statuses for pre-trip
            }}
          >
            <Text
              style={[
                styles.typeButtonText,
                inspectionType === 'pre_trip' && styles.typeButtonTextActive,
              ]}
            >
              Pre-Trip
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.typeButton,
              inspectionType === 'post_trip' && styles.typeButtonActive,
            ]}
            onPress={() => {
              setInspectionType('post_trip')
              setDefects([])
              setDefectsFound(false)
              setComponentStatuses({}) // Reset component statuses for post-trip
            }}
          >
            <Text
              style={[
                styles.typeButtonText,
                inspectionType === 'post_trip' && styles.typeButtonTextActive,
              ]}
            >
              Post-Trip
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Location & Odometer */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location & Odometer</Text>
        {location ? (
          <View style={styles.locationDisplay}>
            <Text style={styles.locationText} selectable>
              {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
            </Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.getLocationButton} onPress={loadLocation}>
            <Text style={styles.getLocationText}>Get Location</Text>
          </TouchableOpacity>
        )}
        <TextInput
          style={styles.input}
          value={odometer}
          onChangeText={setOdometer}
          placeholder="Odometer Reading *"
          placeholderTextColor={COLORS.mutedForeground}
          keyboardType="numeric"
        />
      </View>

      {/* Component Status - Tap to Select (Pre-Trip Only) */}
      {inspectionType === 'pre_trip' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Component Inspection *</Text>
          <Text style={[styles.fieldLabel, { marginBottom: 10, fontSize: 12 }]}>
            Tap each component to mark as OK or Defective
          </Text>
          <View style={styles.componentStatusGrid}>
            {INSPECTION_COMPONENTS.map((component) => {
              const status = componentStatuses[component]
              return (
                <TouchableOpacity
                  key={component}
                  style={[
                    styles.componentStatusButton,
                    status === 'ok' && styles.componentStatusOK,
                    status === 'defective' && styles.componentStatusDefective,
                  ]}
                  onPress={() => {
                    const current = componentStatuses[component]
                    const next = current === 'ok' ? 'defective' : current === 'defective' ? null : 'ok'
                    const newStatuses = { ...componentStatuses, [component]: next }
                    setComponentStatuses(newStatuses)
                    
                    // Auto-add defect if marked as defective
                    if (next === 'defective') {
                      const existingDefect = defects.find(d => d.component === component)
                      if (!existingDefect) {
                        handleAddDefect()
                        const newIndex = defects.length
                        setTimeout(() => {
                          handleDefectChange(newIndex, 'component', component)
                        }, 100)
                      }
                      setDefectsFound(true)
                    } else if (next === 'ok') {
                      // Remove defect for this component if marked as OK
                      const updatedDefects = defects.filter(d => d.component !== component)
                      setDefects(updatedDefects)
                      if (updatedDefects.length === 0) {
                        setDefectsFound(false)
                      }
                    }
                  }}
                >
                  <Text style={[
                    styles.componentStatusText,
                    status === 'ok' && styles.componentStatusTextOK,
                    status === 'defective' && styles.componentStatusTextDefective,
                  ]}>
                    {component}
                  </Text>
                  {status === 'ok' && <Text style={styles.checkmark}>✓</Text>}
                  {status === 'defective' && <Text style={styles.xmark}>✗</Text>}
                </TouchableOpacity>
              )
            })}
          </View>
        </View>
      )}

      {/* Defects Found Toggle */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.toggleRow}
          onPress={() => {
            setDefectsFound(!defectsFound)
            if (!defectsFound) {
              handleAddDefect()
            } else {
              setDefects([])
            }
          }}
        >
          <View style={[styles.checkbox, defectsFound && styles.checkboxChecked]}>
            {defectsFound && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.toggleLabel}>Defects Found</Text>
        </TouchableOpacity>
      </View>

      {/* Defects List */}
      {defectsFound && (
        <View style={styles.section}>
          <View style={styles.defectsHeader}>
            <Text style={styles.sectionTitle}>Defects</Text>
            <TouchableOpacity style={styles.addButton} onPress={handleAddDefect}>
              <Text style={styles.addButtonText}>+ Add Defect</Text>
            </TouchableOpacity>
          </View>
          {defects.map((defect, index) => (
            <View key={index} style={styles.defectCard}>
              <View style={styles.defectHeader}>
                <Text style={styles.defectNumber}>Defect #{index + 1}</Text>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => handleRemoveDefect(index)}
                >
                  <Text style={styles.removeButtonText}>Remove</Text>
                </TouchableOpacity>
              </View>

              {/* Component Selection */}
              <Text style={styles.fieldLabel}>Component *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.componentChips}>
                  {INSPECTION_COMPONENTS.map((component) => (
                    <TouchableOpacity
                      key={component}
                      style={[
                        styles.chip,
                        defect.component === component && styles.chipActive,
                      ]}
                      onPress={() => handleDefectChange(index, 'component', component)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          defect.component === component && styles.chipTextActive,
                        ]}
                      >
                        {component}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* Description */}
              <Text style={styles.fieldLabel}>Description *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={defect.description}
                onChangeText={(text) => handleDefectChange(index, 'description', text)}
                placeholder="Describe the defect..."
                placeholderTextColor={COLORS.mutedForeground}
                multiline
                numberOfLines={2}
              />

              {/* Severity */}
              <Text style={styles.fieldLabel}>Severity *</Text>
              <View style={styles.severitySelector}>
                {DEFECT_SEVERITIES.map((sev) => (
                  <TouchableOpacity
                    key={sev.value}
                    style={[
                      styles.severityButton,
                      defect.severity === sev.value && {
                        backgroundColor: sev.color,
                        borderColor: sev.color,
                      },
                    ]}
                    onPress={() => handleDefectChange(index, 'severity', sev.value)}
                  >
                    <Text
                      style={[
                        styles.severityButtonText,
                        defect.severity === sev.value && styles.severityButtonTextActive,
                      ]}
                    >
                      {sev.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Corrected Toggle */}
              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => handleDefectChange(index, 'corrected', !defect.corrected)}
              >
                <View style={[styles.checkbox, defect.corrected && styles.checkboxChecked]}>
                  {defect.corrected && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.toggleLabel}>Defect Corrected</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Safe to Operate */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.toggleRow}
          onPress={() => setSafeToOperate(!safeToOperate)}
        >
          <View style={[styles.checkbox, safeToOperate && styles.checkboxChecked]}>
            {safeToOperate && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.toggleLabel}>Safe to Operate</Text>
        </TouchableOpacity>
      </View>

      {/* Notes */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notes (Optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Add any additional notes..."
          placeholderTextColor={COLORS.mutedForeground}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      {/* Submit Button */}
      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting || !isRegistered}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>
              Submit {inspectionType === 'pre_trip' ? 'Pre-Trip' : 'Post-Trip'} Inspection
            </Text>
          )}
        </TouchableOpacity>
        {!isRegistered && (
          <Text style={styles.warningText}>
            Register ELD device to submit inspections
          </Text>
        )}
      </View>

      {/* Recent Inspections */}
      {recentInspections.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Inspections</Text>
          {recentInspections.slice(0, 5).map((inspection, index) => (
            <View key={index} style={styles.inspectionCard}>
              <View style={styles.inspectionHeader}>
                <Text style={styles.inspectionType}>
                  {inspection.inspection_type === 'pre_trip' ? 'Pre-Trip' : 'Post-Trip'}
                </Text>
                <Text style={styles.inspectionDate}>
                  {inspection.inspection_date} {inspection.inspection_time}
                </Text>
              </View>
              <View style={styles.inspectionStatus}>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        inspection.status === 'passed'
                          ? COLORS.success
                          : inspection.status === 'defects_corrected'
                          ? '#FF9500'
                          : COLORS.destructive,
                    },
                  ]}
                >
                  <Text style={styles.statusBadgeText}>
                    {inspection.status === 'passed'
                      ? 'Passed'
                      : inspection.status === 'defects_corrected'
                      ? 'Corrected'
                      : 'Failed'}
                  </Text>
                </View>
                {inspection.defects_found && (
                  <Text style={styles.defectsCount}>
                    {inspection.defects?.length || 0} defect(s)
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
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
    marginBottom: 12,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  typeButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  typeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.foreground,
  },
  typeButtonTextActive: {
    color: '#FFFFFF',
  },
  locationDisplay: {
    padding: 12,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    marginBottom: 12,
  },
  locationText: {
    fontSize: 14,
    color: COLORS.foreground,
    fontFamily: 'monospace',
  },
  getLocationButton: {
    padding: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  getLocationText: {
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  xmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  componentStatusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  componentStatusButton: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  componentStatusOK: {
    backgroundColor: COLORS.success + '20',
    borderColor: COLORS.success,
  },
  componentStatusDefective: {
    backgroundColor: COLORS.destructive + '20',
    borderColor: COLORS.destructive,
  },
  componentStatusText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.foreground,
  },
  componentStatusTextOK: {
    color: COLORS.success,
  },
  componentStatusTextDefective: {
    color: COLORS.destructive,
  },
  toggleLabel: {
    fontSize: 16,
    color: COLORS.foreground,
    fontWeight: '500',
  },
  defectsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  defectCard: {
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  defectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  defectNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.foreground,
  },
  removeButton: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    backgroundColor: COLORS.destructive,
    borderRadius: 6,
  },
  removeButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.foreground,
    marginBottom: 8,
    marginTop: 12,
  },
  componentChips: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: 12,
    color: COLORS.foreground,
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  severitySelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  severityButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    alignItems: 'center',
  },
  severityButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.foreground,
  },
  severityButtonTextActive: {
    color: '#FFFFFF',
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  warningText: {
    color: COLORS.destructive,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  inspectionCard: {
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inspectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  inspectionType: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.foreground,
  },
  inspectionDate: {
    fontSize: 12,
    color: COLORS.mutedForeground,
  },
  inspectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  defectsCount: {
    fontSize: 12,
    color: COLORS.mutedForeground,
  },
})
