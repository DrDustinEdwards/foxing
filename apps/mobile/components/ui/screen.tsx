import { type ReactNode } from 'react'
import { type StyleProp, type ViewStyle } from 'react-native'
import { SafeAreaView, type Edge } from 'react-native-safe-area-context'

// Shared screen wrapper. Applies the themed base background and the safe-area
// insets every route needs. Default edges are ['top', 'bottom'] so content and
// bottom-anchored buttons always clear the status bar and the home-bar gesture
// area on edge-to-edge devices (Android 15 / iOS).
//
// Screens that sit behind the bottom tab bar should pass edges={['top']} so the
// tab bar (not the screen) owns the bottom inset.
//
// Do NOT hand-roll SafeAreaView/edges in routes. Use this.

interface ScreenProps {
  children: ReactNode
  edges?: readonly Edge[]
  // Extra classes appended after the base flex-1 + background.
  className?: string
  style?: StyleProp<ViewStyle>
}

const DEFAULT_EDGES: readonly Edge[] = ['top', 'bottom']

export function Screen({
  children,
  edges = DEFAULT_EDGES,
  className,
  style,
}: ScreenProps) {
  return (
    <SafeAreaView
      edges={edges}
      className={`flex-1 bg-bg-base-light dark:bg-bg-base-dark${className ? ` ${className}` : ''}`}
      style={style}
    >
      {children}
    </SafeAreaView>
  )
}
