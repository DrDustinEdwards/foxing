import { View, Text, Pressable } from 'react-native'
import { SheetScaffold } from '@/components/ui/sheet-scaffold'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

export function BottomSheetMenu({
  visible,
  title,
  items,
  onClose,
}: {
  visible: boolean
  title: string
  items: Array<{
    id: string
    label: string
    Icon?: React.ComponentType<{ color: string; size: number; weight?: 'regular' }>
    onPress: () => void
  }>
  onClose: () => void
}) {
  const colors = useColors()
  return (
    <SheetScaffold
      visible={visible}
      onClose={onClose}
      variant="bottom"
      scroll={false}
      header={
        <Text
          style={{
            fontFamily: Fonts.uiMedium,
            fontSize: 12,
            color: colors.textTertiary,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            paddingHorizontal: 20,
            marginBottom: 8,
          }}
        >
          {title}
        </Text>
      }
    >
          {items.map((item, i) => (
            <Pressable
              key={item.id}
              onPress={() => {
                item.onPress()
                onClose()
              }}
              className="flex-row items-center px-5"
              style={{
                minHeight: 56,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.borderSubtle,
              }}
            >
              {item.Icon ? (
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    backgroundColor: colors.brandSubtle,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}
                >
                  <item.Icon color={colors.brandUi} size={16} />
                </View>
              ) : null}
              <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 15, color: colors.textPrimary }}>
                {item.label}
              </Text>
            </Pressable>
          ))}
    </SheetScaffold>
  )
}
