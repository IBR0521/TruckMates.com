/**
 * Platform Button Component
 * EXACT match to TruckMates platform button styles
 */

import React from 'react'
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle, ActivityIndicator } from 'react-native'
import { COLORS } from '../constants/colors'

interface PlatformButtonProps {
  children: React.ReactNode
  onPress?: () => void
  variant?: 'default' | 'outline' | 'ghost' | 'destructive'
  size?: 'default' | 'sm' | 'lg'
  disabled?: boolean
  loading?: boolean
  style?: ViewStyle
  textStyle?: TextStyle
}

export function PlatformButton({
  children,
  onPress,
  variant = 'default',
  size = 'default',
  disabled = false,
  loading = false,
  style,
  textStyle,
}: PlatformButtonProps) {
  const buttonStyle = [
    styles.base,
    styles[variant],
    styles[`size_${size}`],
    (disabled || loading) && styles.disabled,
    style,
  ]

  const textStyleFinal = [
    styles.text,
    styles[`text_${variant}`],
    styles[`textSize_${size}`],
    textStyle,
  ]

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.9}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'default' ? COLORS.foreground : COLORS.primary} />
      ) : (
        <Text style={textStyleFinal}>{children}</Text>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6, // rounded-md = 6px
  },
  default: {
    backgroundColor: COLORS.primary,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  destructive: {
    backgroundColor: COLORS.error,
  },
  size_default: {
    height: 36, // h-9 = 36px
    paddingHorizontal: 16, // px-4 = 16px
    paddingVertical: 8, // py-2 = 8px
  },
  size_sm: {
    height: 32, // h-8 = 32px
    paddingHorizontal: 12, // px-3 = 12px
    paddingVertical: 6,
    borderRadius: 6,
  },
  size_lg: {
    height: 40, // h-10 = 40px
    paddingHorizontal: 24, // px-6 = 24px
    paddingVertical: 10,
    borderRadius: 6,
  },
  size_icon: {
    width: 36, // size-9 = 36px
    height: 36,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  text: {
    fontWeight: '500', // font-medium
  },
  text_default: {
    color: COLORS.foreground,
    fontSize: 14, // text-sm = 14px
  },
  text_outline: {
    color: COLORS.foreground,
    fontSize: 14,
  },
  text_ghost: {
    color: COLORS.foreground,
    fontSize: 14,
  },
  text_destructive: {
    color: COLORS.foreground,
    fontSize: 14,
  },
  textSize_default: {
    fontSize: 14,
  },
  textSize_sm: {
    fontSize: 14,
  },
  textSize_lg: {
    fontSize: 14,
  },
  disabled: {
    opacity: 0.5,
  },
})

