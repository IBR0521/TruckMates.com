# TruckMates Platform Design Analysis

## Layout Structure
- **Container**: `max-w-7xl mx-auto` (centered, max width)
- **Padding**: `p-4 md:p-8` (16px mobile, 32px desktop)
- **Spacing**: `space-y-6` (24px vertical), `gap-4` (16px), `gap-6` (24px)

## Cards
- **Base**: `border border-border/50 p-6`
- **Hover**: `hover:border-border/80 hover:shadow-md transition-all shadow-sm`
- **Background**: `bg-card/50` (semi-transparent)
- **Border radius**: `rounded-xl` (12px) from card component

## Typography
- **Page Title**: `text-2xl md:text-3xl font-bold text-foreground`
- **Card Title**: `text-lg font-bold text-foreground`
- **Label**: `text-sm text-muted-foreground font-medium mb-2`
- **Value (Large)**: `text-2xl font-bold` or `text-3xl font-bold`
- **Small Text**: `text-xs text-muted-foreground`
- **Body**: `text-sm text-foreground`

## Badges
- **Base**: `px-2 py-1 rounded-full text-xs font-semibold`
- **Colors**: 
  - Green: `bg-green-500/20 text-green-400`
  - Blue: `bg-blue-500/20 text-blue-400`
  - Yellow: `bg-yellow-500/20 text-yellow-400`
  - Red: `bg-red-500/20 text-red-400`

## Buttons
- **Default**: `h-9 px-4 py-2 rounded-md text-sm font-medium`
- **Small**: `h-8 px-3 rounded-md`
- **Large**: `h-10 px-6 rounded-md`
- **Outline**: `border bg-background shadow-xs hover:bg-accent`

## Icons
- **Size**: `w-4 h-4` (16px) or `w-5 h-5` (20px)
- **Color**: Usually `text-primary` or `text-muted-foreground`
- **Icon containers**: `p-2 bg-primary/10 rounded-lg`

## Grid Layouts
- **2 columns**: `grid md:grid-cols-2 gap-6`
- **3 columns**: `grid md:grid-cols-3 gap-6`
- **4 columns**: `grid md:grid-cols-4 gap-4`

## Header
- **Style**: `border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4`
- **Shadow**: `shadow-sm`

## Color System (Dark Mode)
- **Background**: `oklch(0.08 0.02 250)` - Very dark blue
- **Card**: `oklch(0.12 0.02 250)` - Slightly lighter
- **Border**: `oklch(0.22 0.02 250)` - Subtle border
- **Primary**: `oklch(0.45 0.15 250)` - Indigo
- **Foreground**: `oklch(0.98 0 0)` - Almost white
- **Muted**: `oklch(0.7 0 0)` - Gray





