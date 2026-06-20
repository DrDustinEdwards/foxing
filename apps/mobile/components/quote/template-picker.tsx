import { View, Text, Pressable } from 'react-native'
import { Fonts } from '@/constants/fonts'
import { useColors } from '@/constants/colors'
import { TEMPLATES, TEMPLATE_ORDER, type TemplateId } from './types'

interface TemplatePickerProps {
  template: TemplateId
  setTemplate: (id: TemplateId) => void
  colors: ReturnType<typeof useColors>
}

export function TemplatePicker({ template, setTemplate, colors }: TemplatePickerProps) {
  return (
    <View className="flex-row gap-2">
      {TEMPLATE_ORDER.map((id) => {
        const t = TEMPLATES[id]
        const active = id === template
        return (
          <Pressable
            key={id}
            onPress={() => setTemplate(id)}
            style={{
              flex: 1,
              aspectRatio: 4 / 5,
              borderRadius: 8,
              overflow: 'hidden',
              borderWidth: active ? 2 : 1,
              borderColor: active ? colors.brandUi : colors.borderSubtle,
              backgroundColor: t.background,
              alignItems: 'center',
              justifyContent: 'center',
              padding: 4,
            }}
          >
            <Text
              style={{
                fontFamily: Fonts.uiMedium,
                fontSize: 10,
                color: t.bodyColor,
              }}
            >
              {t.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
