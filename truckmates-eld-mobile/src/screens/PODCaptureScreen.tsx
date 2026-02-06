/**
 * POD (Proof of Delivery) Capture Screen
 * Capture delivery confirmation with photos and signature
 */

import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  TextInput,
} from 'react-native'
import { launchCamera, launchImageLibrary, ImagePickerResponse } from 'react-native-image-picker'
import { useRoute, useNavigation } from '@react-navigation/native'
import { COLORS } from '../constants/colors'
import { uploadPOD } from '../services/api'
import { format } from 'date-fns'

export default function PODCaptureScreen() {
  const route = useRoute()
  const navigation = useNavigation()
  const { loadId, bolId } = route.params as {
    loadId: string
    bolId?: string
  }

  const [photos, setPhotos] = useState<string[]>([])
  const [receivedBy, setReceivedBy] = useState('')
  const [deliveryCondition, setDeliveryCondition] = useState('good')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  function handleTakePhoto() {
    // TODO: Implement with react-native-image-picker after installation
    // For now, show alert
    Alert.alert(
      'Camera',
      'Camera functionality requires react-native-image-picker. Please install: npm install react-native-image-picker',
      [{ text: 'OK' }]
    )
    // Placeholder implementation:
    // import { launchCamera } from 'react-native-image-picker'
    // launchCamera({ mediaType: 'photo', quality: 0.8 }, (response) => {
    //   if (response.assets?.[0]?.uri) {
    //     setPhotos([...photos, response.assets[0].uri])
    //   }
    // })
  }

  function handleSelectPhoto() {
    // TODO: Implement with react-native-image-picker after installation
    Alert.alert(
      'Gallery',
      'Gallery functionality requires react-native-image-picker. Please install: npm install react-native-image-picker',
      [{ text: 'OK' }]
    )
    // Placeholder implementation:
    // import { launchImageLibrary } from 'react-native-image-picker'
    // launchImageLibrary({ mediaType: 'photo', quality: 0.8 }, (response) => {
    //   if (response.assets?.[0]?.uri) {
    //     setPhotos([...photos, response.assets[0].uri])
    //   }
    // })
  }

  function handleRemovePhoto(index: number) {
    setPhotos(photos.filter((_, i) => i !== index))
  }

  async function handleSubmit() {
    if (photos.length === 0) {
      Alert.alert('Error', 'Please take at least one photo')
      return
    }

    if (!receivedBy.trim()) {
      Alert.alert('Error', 'Please enter the name of the person who received the delivery')
      return
    }

    setIsSubmitting(true)

    try {
      const result = await uploadPOD({
        loadId,
        bolId,
        photos,
        receivedBy: receivedBy.trim(),
        deliveryCondition,
        notes: notes.trim() || null,
        receivedDate: new Date().toISOString(),
      })

      if (result.error) {
        Alert.alert('Error', result.error)
        return
      }

      Alert.alert(
        'Success',
        'Proof of Delivery captured successfully. Invoice will be generated automatically.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      )
    } catch (error: any) {
      console.error('Error submitting POD:', error)
      Alert.alert('Error', error.message || 'Failed to submit POD')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Proof of Delivery</Text>
        <Text style={styles.subtitle}>Capture delivery confirmation</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Photos</Text>
        <Text style={styles.sectionDescription}>
          Take photos of the delivered goods and delivery location
        </Text>

        <View style={styles.photoActions}>
          <TouchableOpacity
            style={[styles.photoButton, styles.cameraButton]}
            onPress={handleTakePhoto}
          >
            <Text style={styles.photoButtonText}>📷 Take Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.photoButton, styles.galleryButton]}
            onPress={handleSelectPhoto}
          >
            <Text style={styles.photoButtonText}>🖼️ Choose from Gallery</Text>
          </TouchableOpacity>
        </View>

        {photos.length > 0 && (
          <View style={styles.photosContainer}>
            {photos.map((uri, index) => (
              <View key={index} style={styles.photoItem}>
                <Image source={{ uri }} style={styles.photo} />
                <TouchableOpacity
                  style={styles.removePhotoButton}
                  onPress={() => handleRemovePhoto(index)}
                >
                  <Text style={styles.removePhotoText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Received By</Text>
        <TextInput
          style={styles.input}
          value={receivedBy}
          onChangeText={setReceivedBy}
          placeholder="Enter name of person who received delivery"
          placeholderTextColor={COLORS.textSecondary}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Delivery Condition</Text>
        <View style={styles.conditionButtons}>
          {['good', 'damaged', 'partial'].map((condition) => (
            <TouchableOpacity
              key={condition}
              style={[
                styles.conditionButton,
                deliveryCondition === condition && styles.conditionButtonActive,
              ]}
              onPress={() => setDeliveryCondition(condition)}
            >
              <Text
                style={[
                  styles.conditionButtonText,
                  deliveryCondition === condition && styles.conditionButtonTextActive,
                ]}
              >
                {condition.charAt(0).toUpperCase() + condition.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notes (Optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Add any additional notes about the delivery"
          placeholderTextColor={COLORS.textSecondary}
          multiline
          numberOfLines={4}
        />
      </View>

      <TouchableOpacity
        style={[styles.submitButton, isSubmitting && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={isSubmitting || photos.length === 0 || !receivedBy.trim()}
      >
        {isSubmitting ? (
          <ActivityIndicator color={COLORS.background} />
        ) : (
          <Text style={styles.submitButtonText}>Submit POD</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  photoActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  photoButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cameraButton: {
    backgroundColor: COLORS.primary,
  },
  galleryButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  photoButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.background,
  },
  photosContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoItem: {
    position: 'relative',
    width: '48%',
    aspectRatio: 1,
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: COLORS.surface,
  },
  removePhotoButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.destructive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePhotoText: {
    color: COLORS.background,
    fontSize: 14,
    fontWeight: 'bold',
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.text,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  conditionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  conditionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
  },
  conditionButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  conditionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  conditionButtonTextActive: {
    color: COLORS.background,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.background,
  },
})

