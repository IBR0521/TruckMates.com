/**
 * Platform Input Component
 * EXACT match to TruckMates platform input styles
 */

import React from 'react'
import { TextInput, StyleSheet, ViewStyle, TextStyle } from 'react-native'
import { COLORS } from '../constants/colors'

interface PlatformInputProps {
  value: string
  onChangeText: (text: string) => void
  placeholder?: string
  placeholderTextColor?: string
  secureTextEntry?: boolean
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad'
  multiline?: boolean
  numberOfLines?: number
  style?: ViewStyle
  textStyle?: TextStyle
  editable?: boolean
}

export function PlatformInput({
  value,
  onChangeText,
  placeholder,
  placeholderTextColor = COLORS.mutedForeground,
  secureTextEntry = false,
  keyboardType = 'default',
  multiline = false,
  numberOfLines,
  style,
  textStyle,
  editable = true,
}: PlatformInputProps) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={placeholderTextColor}
      secureTextEntry={secureTextEntry}
      keyboardType={keyboardType}
      multiline={multiline}
      numberOfLines={numberOfLines}
      editable={editable}
      style={[
        styles.input,
        multiline && styles.inputMultiline,
        !editable && styles.inputDisabled,
        style,
        textStyle,
      ]}
    />
  )
}

const styles = StyleSheet.create({
  input: {
    height: 36, // h-9 = 36px
    backgroundColor: COLORS.input,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderRadius: 6, // rounded-md = 6px
    paddingHorizontal: 12, // px-3 = 12px
    paddingVertical: 8, // py-1 = 8px
    fontSize: 14, // text-sm = 14px (md:text-sm)
    color: COLORS.foreground,
    minWidth: 0,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  inputDisabled: {
    opacity: 0.5,
  },
})





