import { type ReactNode } from 'react'
import { View, Modal, Pressable, type StyleProp, type ViewStyle } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller'

// Shared sheet wrapper. Provides the one-and-only keyboard layer for sheets
// (react-native-keyboard-controller's KeyboardAwareScrollView) plus a footer
// slot that always clears the home-bar inset.
//
// CRITICAL: this owns the keyboard handling. Do NOT pass a ScrollView in
// `children` (it would nest inside KeyboardAwareScrollView) and do NOT wrap
// this in a KeyboardAvoidingView. Pass `scroll={false}` for short, fixed-height
// content that never needs to scroll.
//
//  variant="page"   full-height pageSheet modal (top safe-area, header, body,
//                   footer) -- the default for form sheets.
//  variant="bottom" bottom-anchored rounded sheet that dismisses on backdrop
//                   tap -- for choosers and compact action sheets.

interface SheetScaffoldProps {
  visible: boolean
  onClose: () => void
  children: ReactNode
  header?: ReactNode
  footer?: ReactNode
  variant?: 'page' | 'bottom'
  // Wrap children in the keyboard-aware scroll view (default true). Set false
  // for short content with no inputs that should not scroll.
  scroll?: boolean
  contentContainerStyle?: StyleProp<ViewStyle>
  // bottom variant only: cap the sheet height. Default '85%'.
  maxHeight?: number | `${number}%`
  // Lift the footer above the keyboard (chat-style composers). Uses
  // keyboard-controller's KeyboardStickyView -- still a single keyboard library.
  stickyFooter?: boolean
}

const FOOTER_CLASS =
  'border-t border-border-subtle-light dark:border-border-subtle-dark'

export function SheetScaffold({
  visible,
  onClose,
  children,
  header,
  footer,
  variant = 'page',
  scroll = true,
  contentContainerStyle,
  maxHeight = '85%',
  stickyFooter = false,
}: SheetScaffoldProps) {
  const insets = useSafeAreaInsets()

  const body = scroll ? (
    <KeyboardAwareScrollView
      bottomOffset={24}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
      style={variant === 'page' ? { flex: 1 } : undefined}
      contentContainerStyle={contentContainerStyle}
    >
      {children}
    </KeyboardAwareScrollView>
  ) : (
    <View style={[variant === 'page' ? { flex: 1 } : undefined, contentContainerStyle]}>
      {children}
    </View>
  )

  const footerView = footer ? (
    <View
      className={FOOTER_CLASS}
      style={{ paddingTop: 12, paddingHorizontal: 16, paddingBottom: insets.bottom + 12 }}
    >
      {footer}
    </View>
  ) : null

  const footerNode =
    footerView && stickyFooter ? (
      <KeyboardStickyView>{footerView}</KeyboardStickyView>
    ) : (
      footerView
    )

  if (variant === 'bottom') {
    return (
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <Pressable
          className="flex-1 justify-end"
          onPress={onClose}
          accessibilityLabel="Close sheet"
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            accessibilityViewIsModal
            className="rounded-t-3xl bg-bg-elevated-light dark:bg-bg-elevated-dark border-t border-border-subtle-light dark:border-border-subtle-dark"
            style={{ maxHeight, paddingTop: 12 }}
          >
            {header}
            {body}
            {footerNode ?? (
              <View style={{ height: insets.bottom + 12 }} />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    )
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        edges={['top']}
        className="flex-1 bg-bg-base-light dark:bg-bg-base-dark"
      >
        {header}
        {body}
        {footerNode}
      </SafeAreaView>
    </Modal>
  )
}
