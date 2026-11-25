import { useSetBookStatus } from "@foxing/client";
import type * as W from "@foxing/types";
import { useColors } from "@/constants/colors";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { SheetScaffold } from "@/components/ui/sheet-scaffold";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { Fonts } from "@/constants/fonts";
import { Compass, LinkSimple } from "phosphor-react-native";
import { SectionLabel } from "@/components/ui/section-label";

export function AddBookSheet({
  visible,
  onClose,
  onBrowse,
  onMatch,
}: {
  visible: boolean;
  onClose: () => void;
  onBrowse: () => void;
  onMatch: (slug: string) => void;
}) {
  const colors = useColors();
  // Both steps share one modal to avoid modal stacking jank on Android.
  const [mode, setMode] = useState<"choose" | "url">("choose");
  const [url, setUrl] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const setStatus = useSetBookStatus();

  useEffect(() => {
    if (!visible) {
      // oxlint-disable-next-line react/set-state-in-effect -- resets the sheet each time it closes
      setMode("choose");
      setUrl("");
      setLookupBusy(false);
      setLookupError(null);
    }
  }, [visible]);

  const submitUrl = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed || lookupBusy) return;
    setLookupBusy(true);
    setLookupError(null);
    try {
      const title = titleFromBookUrl(trimmed);
      const match = title
        ? (await api.get<W.SearchPage>(`/search?q=${encodeURIComponent(title)}`)).books[0]
        : undefined;
      if (!match) {
        setLookupError("This book isn't in the Foxing catalog yet.");
        return;
      }
      setStatus.fire({ bookId: match.id, status: "want", book: match });
      onMatch(match.slug);
    } catch (e) {
      setLookupError(e instanceof Error ? e.message : "Lookup failed.");
    } finally {
      setLookupBusy(false);
    }
  }, [lookupBusy, onMatch, setStatus, url]);

  return (
    <SheetScaffold
      visible={visible}
      onClose={onClose}
      variant="bottom"
      header={
        <SectionLabel style={{ paddingHorizontal: 20, marginBottom: 8 }}>
          {mode === "url" ? "Add from URL" : "Add a book"}
        </SectionLabel>
      }
    >
      {mode === "choose" ? (
        <>
          <AddOption Icon={Compass} label="Browse catalog" onPress={onBrowse} />
          <AddOption
            Icon={LinkSimple}
            label="Add from URL"
            onPress={() => setMode("url")}
            topBorder
          />
        </>
      ) : (
        <View style={{ paddingHorizontal: 20 }}>
          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder="Paste a link to a book"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="search"
            onSubmitEditing={() => void submitUrl()}
            editable={!lookupBusy}
            style={{
              fontFamily: Fonts.body,
              fontSize: 14,
              color: colors.textPrimary,
              backgroundColor: colors.bgBase,
              borderColor: colors.borderSubtle,
              borderWidth: 1,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
              marginBottom: 10,
            }}
          />
          {lookupError ? (
            <Text
              style={{
                fontFamily: Fonts.ui,
                fontSize: 12,
                color: colors.textTertiary,
                marginBottom: 10,
              }}
            >
              {lookupError}
            </Text>
          ) : null}
          <View className="flex-row justify-end" style={{ gap: 10 }}>
            <Pressable
              onPress={() => setMode("choose")}
              className="px-4 py-2"
              disabled={lookupBusy}
            >
              <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textSecondary }}>Back</Text>
            </Pressable>
            <Pressable
              onPress={() => void submitUrl()}
              disabled={lookupBusy || !url.trim()}
              className="px-4 py-2 rounded-full"
              style={{
                backgroundColor: url.trim() ? colors.brandUi : colors.bgDisabled,
                opacity: lookupBusy ? 0.7 : 1,
              }}
            >
              {lookupBusy ? (
                <ActivityIndicator color={colors.textOnBrand} size="small" />
              ) : (
                <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textOnBrand }}>Find</Text>
              )}
            </Pressable>
          </View>
        </View>
      )}
    </SheetScaffold>
  );
}

function AddOption({
  Icon,
  label,
  onPress,
  topBorder,
}: {
  Icon: React.ComponentType<{ color: string; size: number }>;
  label: string;
  onPress: () => void;
  topBorder?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-5 py-4"
      style={topBorder ? { borderTopWidth: 1, borderTopColor: colors.borderSubtle } : undefined}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: colors.brandSubtle,
          alignItems: "center",
          justifyContent: "center",
          marginRight: 12,
        }}
      >
        <Icon color={colors.brandUi} size={18} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 15, color: colors.textPrimary }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

function titleFromBookUrl(input: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
  let slug = parsed.pathname.split("/").filter(Boolean).pop() ?? "";
  if (host.endsWith("goodreads.com")) slug = slug.replace(/^\d+[._-]/, "");
  const title = slug
    .replace(/\.html?$/i, "")
    .replace(/[._-]+/g, " ")
    .trim();
  return title && !/^\d+$/.test(title) ? title : null;
}
