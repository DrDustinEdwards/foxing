import { useColors } from '@/constants/colors'
import { pct } from '@/components/profile/stat-tile'
import { Text, View } from 'react-native'
import { Fonts } from '@/constants/fonts'

const XP_TIERS: Array<{ threshold: number; label: string; key: string }> = [
  { threshold: 0, label: 'Bookworm', key: 'bookworm' },
  { threshold: 100, label: 'Reader', key: 'reader' },
  { threshold: 300, label: 'Avid Reader', key: 'avid_reader' },
  { threshold: 600, label: 'Bibliophile', key: 'bibliophile' },
  { threshold: 1000, label: 'Scholar', key: 'scholar' },
  { threshold: 2000, label: 'Master Scholar', key: 'master_scholar' },
]

export function XpProgressCard({ xp }: { xp: number }) {
  const colors = useColors()
  let currentIdx = 0
  for (let i = 0; i < XP_TIERS.length; i++) {
    if (xp >= XP_TIERS[i].threshold) currentIdx = i
  }
  const current = XP_TIERS[currentIdx]
  const next = XP_TIERS[currentIdx + 1] ?? null
  const progressInLevel = xp - current.threshold
  const neededInLevel = next ? next.threshold - current.threshold : 1
  const pct = next
    ? Math.max(0, Math.min(100, Math.round((progressInLevel / neededInLevel) * 100)))
    : 100

  return (
    <View
      className="rounded-2xl p-4 border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
      style={{ marginBottom: 16 }}
    >
      <View
        className="flex-row items-center justify-between"
        style={{ marginBottom: 6 }}
      >
        <Text
          style={{
            fontFamily: Fonts.uiMedium,
            fontSize: 14,
            color: colors.textPrimary,
          }}
        >
          {current.label}
        </Text>
        <Text
          style={{
            fontFamily: Fonts.mono,
            fontSize: 11,
            color: colors.textTertiary,
          }}
        >
          {xp} XP
        </Text>
      </View>
      <View
        style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: colors.bgSunken,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            height: 6,
            width: `${pct}%`,
            backgroundColor: colors.brandUi,
          }}
        />
      </View>
      {next ? (
        <Text
          style={{
            fontFamily: Fonts.ui,
            fontSize: 11,
            color: colors.textTertiary,
            marginTop: 6,
          }}
        >
          {next.label} at {next.threshold} XP
        </Text>
      ) : (
        <Text
          style={{
            fontFamily: Fonts.ui,
            fontSize: 11,
            color: colors.textTertiary,
            marginTop: 6,
          }}
        >
          Max level reached
        </Text>
      )}
    </View>
  )
}
