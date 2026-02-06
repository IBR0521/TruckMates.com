/**
 * Platform Badge Component
 * EXACT match to TruckMates platform badge styles
 */

import React from 'react'
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native'
import { COLORS } from '../constants/colors'

interface PlatformBadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'secondary' | 'outline' | 'destructive'
  style?: ViewStyle
  textStyle?: TextStyle
}

export function PlatformBadge({
  children,
  variant = 'default',
  style,
  textStyle,
}: PlatformBadgeProps) {
  return (
    <View style={[styles.base, styles[variant], style]}>
      <Text style={[styles.text, styles[`text_${variant}`], textStyle]}>
        {children}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6, // rounded-md = 6px
    paddingHorizontal: 8, // px-2 = 8px
    paddingVertical: 2, // py-0.5 = 2px
    borderWidth: 1,
  },
  default: {
    backgroundColor: COLORS.primary,
    borderColor: 'transparent',
  },
  secondary: {
    backgroundColor: COLORS.card,
    borderColor: 'transparent',
  },
  outline: {
    backgroundColor: 'transparent',
    borderColor: COLORS.border,
  },
  destructive: {
    backgroundColor: COLORS.error,
    borderColor: 'transparent',
  },
  text: {
    fontSize: 12, // text-xs = 12px
    fontWeight: '500', // font-medium
  },
  text_default: {
    color: COLORS.foreground,
  },
  text_secondary: {
    color: COLORS.foreground,
  },
  text_outline: {
    color: COLORS.foreground,
  },
  text_destructive: {
    color: COLORS.foreground,
  },
})




