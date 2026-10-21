import { View, Text, Pressable, ScrollView } from 'react-native'
import { Plus } from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import type { CustomShelf } from '@/lib/library'
import { STATUS_SHELVES, type ShelfKey } from '@/components/library/library-types'

export function ShelfTabs({
  activeShelf,
  shelves,
  onSelectShelf,
  onLongPressShelf,
  onNewShelf,
}: {
  activeShelf: ShelfKey
  shelves: CustomShelf[]
  onSelectShelf: (shelf: ShelfKey) => void
  onLongPressShelf: (shelf: CustomShelf) => void
  onNewShelf: () => void
}) {
  const colors = useColors()
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 12, gap: 6, paddingBottom: 4 }}
    >
      {STATUS_SHELVES.map((s) => {
        const active = activeShelf.kind === 'status' && activeShelf.status === s.status
        return (
          <Pressable
            key={s.status}
            onPress={() => onSelectShelf({ kind: 'status', status: s.status, label: s.label })}
            className="px-3 py-2 rounded-full border"
            style={{
              backgroundColor: active ? colors.bgSelected : colors.bgSurface,
              borderColor: active ? colors.borderBrand : colors.borderSubtle,
            }}
          >
            <Text
              style={{
                fontFamily: Fonts.uiMedium,
                fontSize: 12,
                color: active ? colors.brandText : colors.textSecondary,
              }}
            >
              {s.label}
            </Text>
          </Pressable>
        )
      })}
      {shelves.map((s) => {
        const active = activeShelf.kind === 'custom' && activeShelf.shelfId === s.id
        return (
          <Pressable
            key={s.id}
            onPress={() => onSelectShelf({ kind: 'custom', shelfId: s.id, label: s.name })}
            onLongPress={() => onLongPressShelf(s)}
            delayLongPress={350}
            className="px-3 py-2 rounded-full border"
            style={{
              backgroundColor: active ? colors.bgSelected : colors.bgSurface,
              borderColor: active ? colors.borderBrand : colors.borderSubtle,
            }}
          >
            <Text
              style={{
                fontFamily: Fonts.uiMedium,
                fontSize: 12,
                color: active ? colors.brandText : colors.textSecondary,
              }}
            >
              {s.name}
            </Text>
          </Pressable>
        )
      })}
      <Pressable
        onPress={onNewShelf}
        className="flex-row items-center px-3 py-2 rounded-full border"
        style={{ backgroundColor: colors.bgSurface, borderColor: colors.borderSubtle }}
      >
        <Plus color={colors.textSecondary} size={12} weight="bold" />
        <Text
          style={{
            fontFamily: Fonts.uiMedium,
            fontSize: 12,
            color: colors.textSecondary,
            marginLeft: 4,
          }}
        >
          New shelf
        </Text>
      </Pressable>
    </ScrollView>
  )
}
