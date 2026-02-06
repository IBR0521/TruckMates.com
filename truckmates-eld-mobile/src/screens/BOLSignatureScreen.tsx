/**
 * BOL Signature Screen
 * Digital signature capture for Bill of Lading
 */

import React, { useState, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native'
import SignatureCanvas from 'react-native-signature-canvas'
import { useRoute, useNavigation } from '@react-navigation/native'
import { COLORS } from '../constants/colors'
import { uploadBOLSignature } from '../services/api'

const { width } = Dimensions.get('window')

export default function BOLSignatureScreen() {
  const route = useRoute()
  const navigation = useNavigation()
  const { bolId, signatureType = 'driver', loadId } = route.params as {
    bolId: string
    signatureType?: 'shipper' | 'driver' | 'consignee'
    loadId?: string
  }

  const signatureRef = useRef<any>(null)
  const [signature, setSignature] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [signedByName, setSignedByName] = useState('')

  function handleOK(signatureData: string) {
    setSignature(signatureData)
  }

  function handleClear() {
    signatureRef.current?.clearSignature()
    setSignature(null)
  }

  async function handleSubmit() {
    if (!signature) {
      Alert.alert('Error', 'Please provide a signature')
      return
    }

    if (!signedByName.trim()) {
      Alert.alert('Error', 'Please enter your name')
      return
    }

    setIsSubmitting(true)

    try {
      // Convert signature to base64 image
      const base64Data = signature.replace('data:image/png;base64,', '')
      
      const result = await uploadBOLSignature({
        bolId,
        signatureType,
        signatureData: base64Data,
        signedByName: signedByName.trim(),
        loadId,
      })

      if (result.error) {
        Alert.alert('Error', result.error)
        return
      }

      Alert.alert(
        'Success',
        'Signature captured successfully',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      )
    } catch (error: any) {
      console.error('Error submitting signature:', error)
      Alert.alert('Error', error.message || 'Failed to submit signature')
    } finally {
      setIsSubmitting(false)
    }
  }

  const signatureStyle = `
    .m-signature-pad {
      box-shadow: none;
      border: 2px solid ${COLORS.border};
      border-radius: 8px;
    }
    .m-signature-pad--body {
      background-color: white;
    }
    .m-signature-pad--body canvas {
      background-color: white;
    }
  `

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Sign Bill of Lading</Text>
        <Text style={styles.subtitle}>
          {signatureType === 'driver' && 'Driver Signature'}
          {signatureType === 'shipper' && 'Shipper Signature'}
          {signatureType === 'consignee' && 'Consignee Signature'}
        </Text>
      </View>

      <View style={styles.signatureContainer}>
        <SignatureCanvas
          ref={signatureRef}
          onOK={handleOK}
          descriptionText="Sign above"
          clearText="Clear"
          confirmText="Confirm"
          webStyle={signatureStyle}
          backgroundColor="white"
          penColor={COLORS.primary}
          imageType="image/png"
        />
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Name (as it appears on signature)</Text>
        <View style={styles.inputContainer}>
          <Text
            style={styles.input}
            value={signedByName}
            onChangeText={setSignedByName}
            placeholder="Enter your full name"
            placeholderTextColor={COLORS.textSecondary}
          />
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.clearButton]}
          onPress={handleClear}
          disabled={!signature || isSubmitting}
        >
          <Text style={styles.clearButtonText}>Clear</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.submitButton, (!signature || !signedByName.trim() || isSubmitting) && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={!signature || !signedByName.trim() || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color={COLORS.background} />
          ) : (
            <Text style={styles.submitButtonText}>Submit Signature</Text>
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
  signatureContainer: {
    height: 300,
    marginBottom: 24,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  form: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  inputContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  input: {
    fontSize: 16,
    color: COLORS.text,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
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


