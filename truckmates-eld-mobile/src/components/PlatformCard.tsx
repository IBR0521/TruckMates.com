/**
 * Platform Card Component
 * EXACT match to TruckMates platform card styles
 */

import React from 'react'
import { View, StyleSheet, ViewStyle } from 'react-native'
import { COLORS } from '../constants/colors'

interface PlatformCardProps {
  children: React.ReactNode
  style?: ViewStyle
}

export function PlatformCard({ children, style }: PlatformCardProps) {
  return (
    <View style={[styles.card, style]}>
      {children}
    </View>
  )
}

export function PlatformCardHeader({ children, style }: PlatformCardProps) {
  return (
    <View style={[styles.header, style]}>
      {children}
    </View>
  )
}

export function PlatformCardTitle({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <View style={[styles.title, style]}>
      {children}
    </View>
  )
}

export function PlatformCardDescription({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <View style={[styles.description, style]}>
      {children}
    </View>
  )
}

export function PlatformCardContent({ children, style }: PlatformCardProps) {
  return (
    <View style={[styles.content, style]}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card50, // bg-card/50 = 50% opacity
    borderRadius: 12, // rounded-xl = 12px
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 24, // py-6 = 24px
    paddingHorizontal: 24, // px-6 = 24px
    gap: 24, // gap-6 = 24px
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  header: {
    paddingHorizontal: 24,
    gap: 8,
  },
  title: {
    // CardTitle styles
  },
  description: {
    paddingHorizontal: 24,
  },
  content: {
    paddingHorizontal: 24,
  },
})

