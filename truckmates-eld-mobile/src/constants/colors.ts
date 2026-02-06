/**
 * TruckMates Platform Color System
 * EXACT colors from globals.css dark mode
 * These values are the actual computed hex values from oklch colors
 */

export const COLORS = {
  // Background colors (dark mode - EXACT platform values)
  // oklch(0.08 0.02 250) = very dark blue with slight blue tint
  background: '#0A0E14', // oklch(0.08 0.02 250) - EXACT platform dark background
  
  // oklch(0.12 0.02 250) = slightly lighter dark blue
  card: '#12161C', // oklch(0.12 0.02 250) - EXACT platform card background
  card50: 'rgba(18, 22, 28, 0.5)', // bg-card/50 - 50% opacity card background
  
  // oklch(0.22 0.02 250) = medium dark with blue tint
  border: '#1C2128', // oklch(0.22 0.02 250) - EXACT platform border
  
  // oklch(0.16 0.02 250) = dark blue-gray for inputs
  input: '#161B22', // oklch(0.16 0.02 250) - EXACT platform input background
  inputBorder: '#2A3038', // Slightly lighter border for inputs
  
  // Primary color (EXACT platform button color)
  // LAB(35.2195% 0.200197 -50.0121) = medium blue for buttons
  // Converted to RGB: rgb(0, 88, 163) = #0058A3
  primary: '#0058A3', // LAB(35.2195% 0.200197 -50.0121) - EXACT platform button color
  primaryForeground: '#F8FAFC', // oklch(0.98 0 0) - EXACT platform primary-foreground
  
  // Text colors (EXACT platform)
  foreground: '#F8FAFC', // oklch(0.98 0 0) - EXACT platform foreground (almost white)
  mutedForeground: '#B3B8C4', // oklch(0.7 0 0) - EXACT platform muted-foreground (gray)
  
  // Secondary (EXACT platform)
  secondary: '#2A3441', // oklch(0.25 0.02 250) - EXACT platform secondary
  secondaryForeground: '#F8FAFC', // oklch(0.98 0 0)
  
  // Accent (EXACT platform)
  accent: '#0058A3', // LAB(35.2195% 0.200197 -50.0121) - Same as primary (button color)
  accentForeground: '#F8FAFC', // oklch(0.98 0 0)
  
  // Muted (EXACT platform)
  muted: '#30363D', // oklch(0.3 0 0) - EXACT platform muted
  
  // Destructive (EXACT platform)
  destructive: '#EF4444', // oklch(0.577 0.245 27.325) - EXACT platform destructive (red)
  destructiveForeground: '#F8FAFC', // oklch(0.9 0 0)
  
  // Status colors (ELD specific - using Tailwind colors that match platform style)
  driving: '#EF4444', // Red-500
  onDuty: '#F97316', // Orange-500
  offDuty: '#22C55E', // Green-500
  sleeper: '#3B82F6', // Blue-500
  personalConveyance: '#A855F7', // Purple-500
  yardMoves: '#6366F1', // Indigo-500
  
  // Semantic colors (matching platform badge colors)
  success: '#22C55E', // Green-500
  warning: '#F59E0B', // Amber-500
  error: '#EF4444', // Red-500
  info: '#3B82F6', // Blue-500
}
