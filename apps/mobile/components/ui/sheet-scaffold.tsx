import { type ReactNode } from "react";
import { View, Modal, Pressable, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";

// Owns the keyboard handling (KeyboardAwareScrollView): do not pass a ScrollView in children or wrap in a KeyboardAvoidingView; use scroll={false} for short fixed content.
// variant="page" is a full-height pageSheet; "bottom" is a bottom-anchored sheet dismissed by backdrop tap.

interface SheetScaffoldProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  variant?: "page" | "bottom";
  scroll?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  maxHeight?: number | `${number}%`;
  stickyFooter?: boolean;
}

const FOOTER_CLASS = "border-t border-border-subtle-light dark:border-border-subtle-dark";

export function SheetScaffold({
  visible,
  onClose,
  children,
  header,
  footer,
  variant = "page",
  scroll = true,
  contentContainerStyle,
  maxHeight = "85%",
  stickyFooter = false,
}: SheetScaffoldProps) {
  const insets = useSafeAreaInsets();

  const body = scroll ? (
    <KeyboardAwareScrollView
      bottomOffset={24}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
      style={variant === "page" ? { flex: 1 } : undefined}
      contentContainerStyle={contentContainerStyle}
    >
      {children}
    </KeyboardAwareScrollView>
  ) : (
    <View style={[variant === "page" ? { flex: 1 } : undefined, contentContainerStyle]}>
      {children}
    </View>
  );

  const footerView = footer ? (
    <View
      className={FOOTER_CLASS}
      style={{ paddingTop: 12, paddingHorizontal: 16, paddingBottom: insets.bottom + 12 }}
    >
      {footer}
    </View>
  ) : null;

  const footerNode =
    footerView && stickyFooter ? <KeyboardStickyView>{footerView}</KeyboardStickyView> : footerView;

  if (variant === "bottom") {
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
            {footerNode ?? <View style={{ height: insets.bottom + 12 }} />}
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView edges={["top"]} className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
        {header}
        {body}
        {footerNode}
      </SafeAreaView>
    </Modal>
  );
}
