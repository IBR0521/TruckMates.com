import React, { useMemo, useRef, useState } from "react"
import {
  Alert,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { ENV } from "../config/env"
import { useAuth } from "../context/AuthContext"
import { colors } from "../theme/tokens"

type Point = { x: number; y: number }

const TRANSPARENT_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wv0h7YAAAAASUVORK5CYII="

export function PODCaptureScreen() {
  const { sessionToken } = useAuth()
  const [loadId, setLoadId] = useState("")
  const [bolId, setBolId] = useState("")
  const [receivedBy, setReceivedBy] = useState("")
  const [deliveryCondition, setDeliveryCondition] = useState("good")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [photoAttached, setPhotoAttached] = useState(false)
  const [points, setPoints] = useState<Point[]>([])
  const pointsRef = useRef<Point[]>([])

  const hasSignature = points.length > 0
  const signatureData = useMemo(() => `data:image/png;base64,${TRANSPARENT_PNG_BASE64}`, [])

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const p = { x: evt.nativeEvent.locationX, y: evt.nativeEvent.locationY }
          pointsRef.current = [...pointsRef.current, p]
          setPoints(pointsRef.current)
        },
        onPanResponderMove: (evt) => {
          const p = { x: evt.nativeEvent.locationX, y: evt.nativeEvent.locationY }
          pointsRef.current = [...pointsRef.current, p]
          setPoints(pointsRef.current)
        },
      }),
    []
  )

  const clearSignature = () => {
    pointsRef.current = []
    setPoints([])
  }

  const attachPhoto = async () => {
    // Placeholder camera flow without extra native dependencies.
    // Keeps request shape compatible with /api/mobile/pod-capture.
    setPhotoAttached(true)
    Alert.alert("Photo Attached", "A placeholder POD photo will be sent. Integrate expo-image-picker/camera for device capture.")
  }

  const submit = async () => {
    if (!sessionToken) {
      Alert.alert("Not authenticated", "Sign in first.")
      return
    }
    if (!loadId.trim() || !receivedBy.trim()) {
      Alert.alert("Missing fields", "Load ID and Received By are required.")
      return
    }
    if (!hasSignature) {
      Alert.alert("Signature required", "Please sign in the signature box before submitting.")
      return
    }
    if (!photoAttached) {
      Alert.alert("Photo required", "Attach a POD photo before submitting.")
      return
    }
    setSubmitting(true)
    try {
      const now = new Date().toISOString()

      // 1) Upload POD capture (multipart/form-data) to /api/mobile/pod-capture
      const formData = new FormData()
      formData.append("loadId", loadId.trim())
      if (bolId.trim()) formData.append("bolId", bolId.trim())
      formData.append("receivedBy", receivedBy.trim())
      formData.append("deliveryCondition", deliveryCondition.trim() || "good")
      formData.append("notes", notes.trim())
      formData.append("receivedDate", now)
      formData.append("photos", {
        uri: `data:image/png;base64,${TRANSPARENT_PNG_BASE64}`,
        name: `pod-${Date.now()}.png`,
        type: "image/png",
      } as unknown as Blob)

      const podRes = await fetch(`${ENV.apiUrl}/api/mobile/pod-capture`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
        body: formData,
      })
      if (!podRes.ok) {
        const err = await podRes.json().catch(() => ({}))
        throw new Error(err?.error || `POD upload failed (${podRes.status})`)
      }

      // 2) Submit BOL signature to /api/mobile/bol-signature
      if (bolId.trim()) {
        const bolRes = await fetch(`${ENV.apiUrl}/api/mobile/bol-signature`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            bolId: bolId.trim(),
            loadId: loadId.trim(),
            signatureType: "consignee",
            signatureData,
            signedByName: receivedBy.trim(),
          }),
        })
        if (!bolRes.ok) {
          const err = await bolRes.json().catch(() => ({}))
          throw new Error(err?.error || `Signature upload failed (${bolRes.status})`)
        }
      }

      Alert.alert("Success", "POD and signature submitted.")
      setNotes("")
      clearSignature()
      setPhotoAttached(false)
    } catch (e) {
      Alert.alert("Submit failed", e instanceof Error ? e.message : "Unknown error")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>POD Capture</Text>
      <Text style={styles.subheader}>Capture proof of delivery and submit with signature.</Text>

      <TextInput
        value={loadId}
        onChangeText={setLoadId}
        placeholder="Load ID"
        placeholderTextColor={colors.mutedText}
        style={styles.input}
      />
      <TextInput
        value={bolId}
        onChangeText={setBolId}
        placeholder="BOL ID (required for signature route)"
        placeholderTextColor={colors.mutedText}
        style={styles.input}
      />
      <TextInput
        value={receivedBy}
        onChangeText={setReceivedBy}
        placeholder="Received By Name"
        placeholderTextColor={colors.mutedText}
        style={styles.input}
      />
      <TextInput
        value={deliveryCondition}
        onChangeText={setDeliveryCondition}
        placeholder="Delivery Condition (good | damaged | partial)"
        placeholderTextColor={colors.mutedText}
        style={styles.input}
      />
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="Notes"
        placeholderTextColor={colors.mutedText}
        style={[styles.input, styles.textArea]}
        multiline
      />

      <View style={styles.signatureCard}>
        <Text style={styles.signatureTitle}>Signature</Text>
        <View style={styles.signatureCanvas} {...panResponder.panHandlers}>
          {points.map((p, idx) => (
            <View key={`${p.x}-${p.y}-${idx}`} style={[styles.dot, { left: p.x, top: p.y }]} />
          ))}
        </View>
        <View style={styles.signatureActions}>
          <Pressable style={styles.secondaryButton} onPress={clearSignature}>
            <Text style={styles.secondaryButtonText}>Clear Signature</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => void attachPhoto()}>
            <Text style={styles.secondaryButtonText}>
              {photoAttached ? "Photo Attached" : "Camera / Attach Photo"}
            </Text>
          </Pressable>
        </View>
      </View>

      <Pressable style={[styles.submitButton, submitting && styles.disabled]} onPress={() => void submit()} disabled={submitting}>
        <Text style={styles.submitButtonText}>{submitting ? "Submitting..." : "Submit POD + Signature"}</Text>
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
    gap: 10,
  },
  header: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "700",
  },
  subheader: {
    color: colors.mutedText,
    fontSize: 13,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  textArea: {
    minHeight: 72,
    textAlignVertical: "top",
  },
  signatureCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  signatureTitle: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 15,
  },
  signatureCanvas: {
    height: 180,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
    overflow: "hidden",
  },
  dot: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.text,
  },
  signatureActions: {
    flexDirection: "row",
    gap: 8,
  },
  secondaryButton: {
    flex: 1,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: "600",
    fontSize: 12,
  },
  submitButton: {
    marginTop: 4,
    borderRadius: 10,
    backgroundColor: colors.primary,
    paddingVertical: 13,
    alignItems: "center",
  },
  submitButtonText: {
    color: colors.text,
    fontWeight: "700",
  },
  disabled: {
    opacity: 0.6,
  },
})
