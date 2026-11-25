import { keys, useMyAnnotations } from "@foxing/client";
import type * as W from "@foxing/types";
import { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Share,
  TextInput,
  Alert,
} from "react-native";
import { Screen } from "@/components/ui/screen";
import { ErrorState } from "@/components/ui/error-state";
import { SheetScaffold } from "@/components/ui/sheet-scaffold";
import { Plus, ShareNetwork, Trash, Eye, EyeSlash } from "phosphor-react-native";
import { queryClient, queueWrite } from "@/lib/api";
import { useColors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { relativeTime } from "@/lib/relative-time";
import { BackHeader } from "@/components/ui/back-header";

type Filter = "all" | "public" | "private";

const TYPES: W.AnnotationType[] = ["commonplace", "note"];

export default function CommonplaceScreen() {
  const colors = useColors();
  const query = useMyAnnotations(TYPES);
  const entries = useMemo(() => query.data ?? [], [query.data]);
  const loading = query.isPending;
  const [filter, setFilter] = useState<Filter>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [passage, setPassage] = useState("");
  const [bookTitle, setBookTitle] = useState("");
  const [note, setNote] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const saving = useRef(false);

  const visible = useMemo(() => {
    if (filter === "all") return entries;
    if (filter === "public") return entries.filter((e) => e.visibility === "public");
    return entries.filter((e) => e.visibility !== "public");
  }, [entries, filter]);

  const patchEntries = (fn: (list: W.MyAnnotation[]) => W.MyAnnotation[]) =>
    queryClient.setQueryData<W.MyAnnotation[]>(keys.myAnnotations(TYPES.join(",")), (list) =>
      fn(list ?? []),
    );

  async function saveEntry() {
    const text = passage.trim().slice(0, 5000);
    if (!text || saving.current) return;
    saving.current = true;
    const entry: W.MyAnnotation = {
      id: "",
      type: "commonplace",
      selectedText: text,
      body: note.trim() || null,
      color: null,
      chapter: null,
      sourceTitle: bookTitle.trim() || null,
      visibility: isPublic ? "public" : "private",
      createdAt: Date.now(),
      bookId: null,
      bookTitle: null,
      bookSlug: null,
      bookAuthor: null,
    };
    const {
      id: _id,
      createdAt: _at,
      bookTitle: _t,
      bookSlug: _s,
      bookAuthor: _a,
      ...payload
    } = entry;
    try {
      entry.id = await queueWrite({ resource: "annotation", verb: "create", payload });
    } finally {
      saving.current = false;
    }
    patchEntries((list) => [entry, ...list]);
    setPassage("");
    setBookTitle("");
    setNote("");
    setIsPublic(false);
    setAddOpen(false);
  }

  function removeEntry(id: string) {
    Alert.alert("Delete entry?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          patchEntries((list) => list.filter((e) => e.id !== id));
          void queueWrite({ resource: "annotation", verb: "delete", id });
        },
      },
    ]);
  }

  async function exportAll() {
    if (entries.length === 0) return;
    const text = entries
      .map((e) => `${passageOf(e)}\n- ${sourceOf(e)}${noteOf(e) ? `\nNote: ${noteOf(e)}` : ""}`)
      .join("\n\n");
    try {
      await Share.share({ message: text });
    } catch (err) {
      console.warn("[commonplace] share failed", err);
    }
  }

  return (
    <Screen>
      <BackHeader title="Commonplace Book">
        <Pressable
          onPress={() => void exportAll()}
          hitSlop={10}
          className="p-2"
          accessibilityRole="button"
          accessibilityLabel="Share all"
        >
          <ShareNetwork color={colors.textSecondary} size={20} />
        </Pressable>
        <Pressable
          onPress={() => setAddOpen(true)}
          hitSlop={10}
          className="p-2"
          accessibilityRole="button"
          accessibilityLabel="Add entry"
        >
          <Plus color={colors.brandUi} size={22} weight="bold" />
        </Pressable>
      </BackHeader>

      <View className="flex-row gap-2 px-4 pb-3">
        {(["all", "public", "private"] as Filter[]).map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: filter === f ? colors.brandSubtle : colors.bgSurface,
              borderWidth: 1,
              borderColor: colors.borderSubtle,
            }}
          >
            <Text
              style={{
                fontFamily: Fonts.uiMedium,
                fontSize: 12,
                color: filter === f ? colors.textPrimary : colors.textTertiary,
                textTransform: "capitalize",
              }}
            >
              {f}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brandUi} />
        </View>
      ) : query.isError && !query.data ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : visible.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text
            style={{
              fontFamily: Fonts.body,
              fontSize: 14,
              color: colors.textTertiary,
              textAlign: "center",
            }}
          >
            Nothing saved yet.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
          {visible.map((e) => (
            <View
              key={e.id}
              className="p-4 mb-3 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
            >
              <Text
                style={{
                  fontFamily: Fonts.bodyItalic,
                  fontSize: 16,
                  lineHeight: 24,
                  color: colors.textPrimary,
                }}
              >
                {passageOf(e)}
              </Text>
              <Text
                style={{
                  fontFamily: Fonts.ui,
                  fontSize: 12,
                  color: colors.textTertiary,
                  marginTop: 8,
                }}
              >
                {sourceOf(e)}
              </Text>
              {noteOf(e) ? (
                <Text
                  style={{
                    fontFamily: Fonts.body,
                    fontSize: 13,
                    color: colors.textSecondary,
                    marginTop: 6,
                  }}
                >
                  {noteOf(e)}
                </Text>
              ) : null}
              <View className="flex-row items-center justify-between mt-3">
                <View className="flex-row items-center">
                  {e.visibility === "public" ? (
                    <Eye color={colors.info} size={14} />
                  ) : (
                    <EyeSlash color={colors.textTertiary} size={14} />
                  )}
                  <Text
                    style={{
                      fontFamily: Fonts.ui,
                      fontSize: 11,
                      color: colors.textTertiary,
                      marginLeft: 6,
                    }}
                  >
                    {e.visibility === "public" ? "Public" : "Private"} · {relativeTime(e.createdAt)}
                  </Text>
                </View>
                <Pressable
                  onPress={() => removeEntry(e.id)}
                  hitSlop={10}
                  className="p-1"
                  accessibilityRole="button"
                  accessibilityLabel="Delete entry"
                >
                  <Trash color={colors.textTertiary} size={16} />
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <SheetScaffold
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        header={
          <BackHeader title="Save a passage" onBack={() => setAddOpen(false)}>
            <Pressable
              onPress={() => void saveEntry()}
              disabled={!passage.trim()}
              className="px-4 py-2 rounded-full"
              style={{
                backgroundColor: passage.trim() ? colors.brandUi : colors.bgDisabled,
              }}
            >
              <Text
                style={{
                  fontFamily: Fonts.uiMedium,
                  color: colors.textOnBrand,
                  fontSize: 13,
                }}
              >
                Save
              </Text>
            </Pressable>
          </BackHeader>
        }
      >
        <TextInput
          value={passage}
          onChangeText={setPassage}
          placeholder="Paste a passage..."
          placeholderTextColor={colors.textTertiary}
          multiline
          maxLength={5000}
          style={{
            fontFamily: Fonts.bodyItalic,
            fontSize: 16,
            color: colors.textPrimary,
            backgroundColor: colors.bgSurface,
            borderColor: colors.borderSubtle,
            borderWidth: 1,
            borderRadius: 10,
            padding: 12,
            minHeight: 140,
            textAlignVertical: "top",
          }}
        />
        <TextInput
          value={bookTitle}
          onChangeText={setBookTitle}
          placeholder="Book title (optional)"
          placeholderTextColor={colors.textTertiary}
          maxLength={200}
          style={{
            fontFamily: Fonts.body,
            fontSize: 15,
            color: colors.textPrimary,
            backgroundColor: colors.bgSurface,
            borderColor: colors.borderSubtle,
            borderWidth: 1,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        />
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Note (optional)"
          placeholderTextColor={colors.textTertiary}
          maxLength={500}
          multiline
          style={{
            fontFamily: Fonts.body,
            fontSize: 15,
            color: colors.textPrimary,
            backgroundColor: colors.bgSurface,
            borderColor: colors.borderSubtle,
            borderWidth: 1,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 10,
            minHeight: 60,
            textAlignVertical: "top",
          }}
        />
        <Pressable
          onPress={() => setIsPublic((v) => !v)}
          className="flex-row items-center gap-3 p-3 rounded-xl border border-border-subtle-light dark:border-border-subtle-dark"
        >
          {isPublic ? (
            <Eye color={colors.info} size={18} />
          ) : (
            <EyeSlash color={colors.textTertiary} size={18} />
          )}
          <Text
            style={{
              fontFamily: Fonts.body,
              fontSize: 14,
              color: colors.textPrimary,
            }}
          >
            {isPublic ? "Public on profile" : "Private to you"}
          </Text>
        </Pressable>
      </SheetScaffold>
    </Screen>
  );
}

const passageOf = (e: W.MyAnnotation) => e.selectedText ?? e.body ?? "";
const noteOf = (e: W.MyAnnotation) => (e.selectedText ? e.body : null);
const sourceOf = (e: W.MyAnnotation) =>
  e.bookTitle
    ? `${e.bookTitle}${e.bookAuthor ? ` · ${e.bookAuthor}` : ""}`
    : (e.sourceTitle ?? "Unknown book");
