import { useState } from 'react'
import { View, Text, Pressable, ActivityIndicator } from 'react-native'
import { CaretRight, CaretDown } from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import type { BookInsightLens, DeepDiveKind } from '@/lib/book-ai'

export function InsightCard({
  lens,
  label,
  state,
  onOpen,
}: {
  lens: BookInsightLens
  label: string
  state: string | 'loading' | 'error' | undefined
  onOpen: () => void
}) {
  const colors = useColors()
  const [open, setOpen] = useState(false)
  const expand = () => {
    setOpen((v) => !v)
    if (!open && !state) onOpen()
  }
  return (
    <View
      className="rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
    >
      <Pressable onPress={expand} className="flex-row items-center justify-between p-3">
        <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textPrimary }}>
          {label}
        </Text>
        {open ? (
          <CaretDown color={colors.textTertiary} size={14} />
        ) : (
          <CaretRight color={colors.textTertiary} size={14} />
        )}
      </Pressable>
      {open ? (
        <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
          {state === 'loading' ? (
            <ActivityIndicator color={colors.brandUi} />
          ) : state === 'error' ? (
            <Text style={{ fontFamily: Fonts.ui, fontSize: 12, color: colors.error }}>
              Couldn't generate this right now.
            </Text>
          ) : typeof state === 'string' ? (
            <Text
              style={{
                fontFamily: Fonts.body,
                fontSize: 13,
                color: colors.textPrimary,
                lineHeight: 20,
              }}
            >
              {state}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

export function DeepDiveCard({
  kind,
  label,
  state,
  onOpen,
}: {
  kind: DeepDiveKind
  label: string
  state: string | 'loading' | 'error' | undefined
  onOpen: () => void
}) {
  const colors = useColors()
  const [open, setOpen] = useState(false)
  // Mirror of InsightCard but with a wider body (deep-dive responses run
  // longer than the 3-4 sentence insight lens responses).
  const expand = () => {
    setOpen((v) => !v)
    if (!open && !state) onOpen()
  }
  void kind // kind is part of the public surface so callers can key state
  return (
    <View
      className="rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
    >
      <Pressable onPress={expand} className="flex-row items-center justify-between p-3">
        <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textPrimary }}>
          {label}
        </Text>
        {open ? (
          <CaretDown color={colors.textTertiary} size={14} />
        ) : (
          <CaretRight color={colors.textTertiary} size={14} />
        )}
      </Pressable>
      {open ? (
        <View style={{ paddingHorizontal: 12, paddingBottom: 14 }}>
          {state === 'loading' ? (
            <ActivityIndicator color={colors.brandUi} />
          ) : state === 'error' ? (
            <Text style={{ fontFamily: Fonts.ui, fontSize: 12, color: colors.error }}>
              Couldn't generate this right now.
            </Text>
          ) : typeof state === 'string' ? (
            <Text
              style={{
                fontFamily: Fonts.body,
                fontSize: 13,
                color: colors.textPrimary,
                lineHeight: 20,
              }}
            >
              {state}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}
