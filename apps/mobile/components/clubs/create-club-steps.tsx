import { useSearch } from "@foxing/client";
import type * as W from "@foxing/types";
import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, Image, ActivityIndicator, Switch } from "react-native";
import { X as XIcon, Check, BookOpen } from "phosphor-react-native";
import { useColors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { inputStyle } from "@/components/ui/form-field";

export type ClubPace = "chill" | "steady" | "fast";

const PACE_OPTIONS: Array<{ id: ClubPace; label: string; subtitle: string }> = [
  { id: "chill", label: "Chill", subtitle: "1 chapter/week" },
  { id: "steady", label: "Steady", subtitle: "2-3 chapters/week" },
  { id: "fast", label: "Fast", subtitle: "Daily" },
];

export interface CreatedClub {
  id: string;
  slug: string | null;
  name: string;
  isPublic: boolean;
}

export interface DraftState {
  name: string;
  description: string;
  isPublic: boolean;
  book: W.BookCard | null;
  pace: ClubPace;
}

export function BasicsStep({
  draft,
  setDraft,
}: {
  draft: DraftState;
  setDraft: (next: DraftState) => void;
}) {
  const colors = useColors();
  return (
    <View>
      <StepTitle>The basics</StepTitle>

      <Label>Name</Label>
      <TextInput
        value={draft.name}
        onChangeText={(t) => setDraft({ ...draft, name: t })}
        placeholder="The Wuthering Heights Society"
        placeholderTextColor={colors.textTertiary}
        maxLength={60}
        style={inputStyle(colors)}
      />

      <Label>Description (optional)</Label>
      <TextInput
        value={draft.description}
        onChangeText={(t) => setDraft({ ...draft, description: t })}
        placeholder="What is this club about? Who is it for?"
        placeholderTextColor={colors.textTertiary}
        multiline
        numberOfLines={4}
        maxLength={400}
        style={{ ...inputStyle(colors), height: 110, textAlignVertical: "top" }}
      />

      <View className="flex-row items-center justify-between mt-4 p-3 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark">
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textPrimary }}>
            Public club
          </Text>
        </View>
        <Switch
          value={draft.isPublic}
          onValueChange={(v) => setDraft({ ...draft, isPublic: v })}
          trackColor={{ false: colors.bgDisabled, true: colors.toggleOn }}
        />
      </View>
    </View>
  );
}

export function BookStep({
  draft,
  setDraft,
}: {
  draft: DraftState;
  setDraft: (next: DraftState) => void;
}) {
  const colors = useColors();
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setTerm(query.trim().length >= 2 ? query.trim() : ""), 300);
    return () => clearTimeout(t);
  }, [query]);
  const search = useSearch(term);
  const busy = term.length > 0 && search.isFetching;
  const results = term ? (search.data?.books ?? []).slice(0, 10) : [];

  return (
    <View>
      <StepTitle>What are you reading?</StepTitle>

      {draft.book ? (
        <View className="flex-row p-3 rounded-xl border bg-bg-selected-light dark:bg-bg-selected-dark border-border-brand-light dark:border-border-brand-dark">
          <BookCover book={draft.book} />
          <View style={{ flex: 1, marginLeft: 12, justifyContent: "center" }}>
            <Text
              style={{ fontFamily: Fonts.uiMedium, fontSize: 15, color: colors.textPrimary }}
              numberOfLines={2}
            >
              {draft.book.title}
            </Text>
            <Text
              style={{
                fontFamily: Fonts.ui,
                fontSize: 12,
                color: colors.textTertiary,
                marginTop: 2,
              }}
              numberOfLines={1}
            >
              {draft.book.author}
            </Text>
          </View>
          <Pressable
            onPress={() => setDraft({ ...draft, book: null })}
            hitSlop={8}
            style={{ padding: 6 }}
            accessibilityLabel="Clear book"
          >
            <XIcon color={colors.textSecondary} size={18} />
          </Pressable>
        </View>
      ) : (
        <>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search a title…"
            placeholderTextColor={colors.textTertiary}
            style={inputStyle(colors)}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {busy ? (
            <View style={{ padding: 12, alignItems: "center" }}>
              <ActivityIndicator color={colors.brandUi} />
            </View>
          ) : null}
          {results.map((b) => (
            <Pressable
              key={b.id}
              onPress={() => setDraft({ ...draft, book: b })}
              className="flex-row mt-2 p-3 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
            >
              <BookCover book={b} />
              <View style={{ flex: 1, marginLeft: 12, justifyContent: "center" }}>
                <Text
                  style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textPrimary }}
                  numberOfLines={2}
                >
                  {b.title}
                </Text>
                <Text
                  style={{
                    fontFamily: Fonts.ui,
                    fontSize: 12,
                    color: colors.textTertiary,
                    marginTop: 2,
                  }}
                  numberOfLines={1}
                >
                  {b.author}
                </Text>
              </View>
            </Pressable>
          ))}
        </>
      )}
    </View>
  );
}

function BookCover({ book }: { book: W.BookCard }) {
  const colors = useColors();
  return (
    <View
      style={{
        width: 40,
        height: 60,
        borderRadius: 4,
        overflow: "hidden",
        backgroundColor: colors.bgSunken,
      }}
    >
      {book.coverUrl ? (
        <Image source={{ uri: book.coverUrl }} style={{ width: "100%", height: "100%" }} />
      ) : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <BookOpen color={colors.textTertiary} size={16} />
        </View>
      )}
    </View>
  );
}

export function PaceStep({
  draft,
  setDraft,
}: {
  draft: DraftState;
  setDraft: (next: DraftState) => void;
}) {
  const colors = useColors();
  return (
    <View>
      <StepTitle>Reading pace</StepTitle>

      {PACE_OPTIONS.map((p) => {
        const selected = draft.pace === p.id;
        return (
          <Pressable
            key={p.id}
            onPress={() => setDraft({ ...draft, pace: p.id })}
            className="flex-row items-center p-4 mb-2 rounded-xl border"
            style={{
              backgroundColor: selected ? colors.bgSelected : colors.bgSurface,
              borderColor: selected ? colors.borderBrand : colors.borderSubtle,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 15, color: colors.textPrimary }}>
                {p.label}
              </Text>
              <Text
                style={{
                  fontFamily: Fonts.ui,
                  fontSize: 12,
                  color: colors.textTertiary,
                  marginTop: 2,
                }}
              >
                {p.subtitle}
              </Text>
            </View>
            {selected ? <Check color={colors.brandUi} size={18} weight="bold" /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function InviteStep({ club }: { club: CreatedClub | null }) {
  const colors = useColors();
  if (!club) {
    return (
      <View>
        <StepTitle>Almost there…</StepTitle>
      </View>
    );
  }
  return (
    <View>
      <StepTitle>You're in</StepTitle>
      <StepHint>
        {club.name} is live.{" "}
        {club.isPublic ? "Anyone can find and join." : "Share the link to invite readers."}
      </StepHint>

      <View className="p-4 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark">
        <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 12, color: colors.textTertiary }}>
          Club link
        </Text>
        <Text
          selectable
          style={{
            fontFamily: Fonts.mono,
            fontSize: 13,
            color: colors.textPrimary,
            marginTop: 6,
          }}
        >
          https://foxing.app/clubs/{club.slug ?? club.id}
        </Text>
      </View>
    </View>
  );
}

function StepTitle({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <Text
      style={{
        fontFamily: Fonts.displayBold,
        fontSize: 22,
        color: colors.textPrimary,
        marginBottom: 4,
      }}
    >
      {children}
    </Text>
  );
}

function StepHint({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <Text
      style={{
        fontFamily: Fonts.body,
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: 20,
        lineHeight: 20,
      }}
    >
      {children}
    </Text>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <Text
      style={{
        fontFamily: Fonts.uiMedium,
        fontSize: 12,
        color: colors.textTertiary,
        marginTop: 16,
        marginBottom: 6,
        textTransform: "uppercase",
        letterSpacing: 0.6,
      }}
    >
      {children}
    </Text>
  );
}
