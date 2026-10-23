import { View, Text, Pressable, Linking } from 'react-native'
import { Lock } from 'phosphor-react-native'
import { SheetScaffold } from '@/components/ui/sheet-scaffold'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { SITE_ORIGIN } from '@/constants/origins'

// Clean upgrade prompt shown when a free user taps a Plus-gated AI entry,
// instead of letting the edge function call fail with a raw error. The CTA
// opens the web pricing page (the same /pricing route the web app links to).
const PLUS_URL = `${SITE_ORIGIN}/pricing`

interface UpgradeSheetProps {
  visible: boolean
  onClose: () => void
  // The action the user tried to use, for the headline (e.g. "Translate").
  feature?: string
}

export function UpgradeSheet({ visible, onClose, feature }: UpgradeSheetProps) {
  const colors = useColors()
  return (
    <SheetScaffold
      visible={visible}
      onClose={onClose}
      variant="bottom"
      scroll={false}
      contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 8 }}
    >
      <View style={{ alignItems: 'center', paddingTop: 8 }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: colors.brandSubtle,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 14,
          }}
        >
          <Lock color={colors.brandUi} size={24} weight="fill" />
        </View>
        <Text
          style={{
            fontFamily: Fonts.display,
            fontSize: 20,
            color: colors.textPrimary,
            textAlign: 'center',
            marginBottom: 6,
          }}
        >
          {feature ? `${feature} is a Plus feature` : 'A Foxing Plus feature'}
        </Text>
        <Text
          style={{
            fontFamily: Fonts.body,
            fontSize: 15,
            lineHeight: 22,
            color: colors.textSecondary,
            textAlign: 'center',
            marginBottom: 20,
          }}
        >
          Foxing Plus unlocks the AI reading companion: ask questions, analyze
          passages, translate, build character maps, and use the chapter tools.
        </Text>
        <Pressable
          onPress={() => {
            Linking.openURL(PLUS_URL).catch(() => {})
            onClose()
          }}
          accessibilityRole="button"
          accessibilityLabel="Unlock with Plus"
          style={{
            width: '100%',
            backgroundColor: colors.brandUi,
            borderRadius: 14,
            paddingVertical: 14,
            alignItems: 'center',
            marginBottom: 10,
          }}
        >
          <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 15, color: colors.textOnBrand }}>
            Unlock with Plus
          </Text>
        </Pressable>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Not now"
          style={{ paddingVertical: 8 }}
        >
          <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textTertiary }}>
            Not now
          </Text>
        </Pressable>
        <Text style={{ fontFamily: Fonts.ui, fontSize: 12, color: colors.textTertiary, marginTop: 4 }}>
          foxing.app/pricing
        </Text>
      </View>
    </SheetScaffold>
  )
}
