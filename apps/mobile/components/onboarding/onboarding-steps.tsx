import { useState } from "react";
import { View, Text, Pressable, TextInput, Image, ActivityIndicator } from "react-native";
import { Screen } from "@/components/ui/screen";
import { Check, BookOpen } from "phosphor-react-native";
import type { BookCard } from "@foxing/types";
import { Colors, useColors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";

export function isValidGoal(value: string): boolean {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n >= 1 && n <= 200;
}

const C = Colors.dark;

export function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bgBase }}>
      <Screen style={{ alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
        <Text
          style={{
            fontFamily: Fonts.display,
            fontSize: 56,
            color: C.brandUi,
            marginBottom: 12,
            letterSpacing: -1,
          }}
        >
          Foxing
        </Text>
        <Text
          style={{
            fontFamily: Fonts.bodyItalic,
            fontSize: 18,
            color: C.textPrimary,
            marginBottom: 48,
            textAlign: "center",
          }}
        >
          reading, together.
        </Text>
        <Pressable
          onPress={onStart}
          accessibilityRole="button"
          accessibilityLabel="Start"
          style={{
            backgroundColor: C.brandUi,
            paddingHorizontal: 28,
            paddingVertical: 14,
            borderRadius: 999,
          }}
        >
          <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 15, color: C.textOnBrand }}>
            Start
          </Text>
        </Pressable>
      </Screen>
    </View>
  );
}

export function TasteStep({
  genres,
  setGenres,
  options,
  goalBooks,
  setGoalBooks,
}: {
  genres: Set<string>;
  setGenres: (s: Set<string>) => void;
  options: string[];
  goalBooks: string;
  setGoalBooks: (v: string) => void;
}) {
  const colors = useColors();
  const [year] = useState(() => new Date().getFullYear());
  return (
    <View>
      <Heading>What do you love to read?</Heading>
      <Sub>Pick at least two so we can tailor your feed.</Sub>
      <View className="flex-row flex-wrap" style={{ gap: 10 }}>
        {options.map((g) => {
          const active = genres.has(g);
          return (
            <Pressable
              key={g}
              onPress={() => {
                const next = new Set(genres);
                if (next.has(g)) next.delete(g);
                else next.add(g);
                setGenres(next);
              }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
              accessibilityLabel={g}
              className="flex-row items-center justify-center px-4 py-4 rounded-2xl border"
              style={{
                width: "47%",
                backgroundColor: active ? colors.bgSelected : colors.bgSurface,
                borderColor: active ? colors.borderBrand : colors.borderSubtle,
              }}
            >
              {active ? <Check color={colors.brandText} size={14} weight="bold" /> : null}
              <Text
                style={{
                  fontFamily: Fonts.uiMedium,
                  fontSize: 13,
                  color: active ? colors.brandText : colors.textPrimary,
                  marginLeft: active ? 6 : 0,
                  textAlign: "center",
                }}
                numberOfLines={2}
              >
                {g}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ marginTop: 24 }}>
        <Heading>How many books do you want to read this year?</Heading>
        <Sub>Pick a number between 1 and 200. You can change it later.</Sub>
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <Text style={{ fontFamily: Fonts.body, fontSize: 15, color: colors.textSecondary }}>
            I want to read
          </Text>
          <TextInput
            value={goalBooks}
            onChangeText={(t) => setGoalBooks(t.replace(/[^0-9]/g, "").slice(0, 3))}
            keyboardType="number-pad"
            maxLength={3}
            accessibilityLabel="Books per year goal"
            style={{
              fontFamily: Fonts.mono,
              fontSize: 18,
              color: colors.textPrimary,
              backgroundColor: colors.bgSurface,
              borderColor: isValidGoal(goalBooks) ? colors.borderInteractive : colors.error,
              borderWidth: 1,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 8,
              minWidth: 70,
              textAlign: "center",
            }}
          />
          <Text style={{ fontFamily: Fonts.body, fontSize: 15, color: colors.textSecondary }}>
            books in {year}
          </Text>
        </View>
      </View>
    </View>
  );
}

export function ProfileStep({
  username,
  setUsername,
  displayName,
  setDisplayName,
  status,
}: {
  username: string;
  setUsername: (v: string) => void;
  displayName: string;
  setDisplayName: (v: string) => void;
  status: "invalid" | "checking" | "available" | "taken" | null;
}) {
  const colors = useColors();
  const input =
    "font-ui rounded-xl px-4 py-4 text-base bg-bg-surface-light dark:bg-bg-surface-dark text-text-primary-light dark:text-text-primary-dark border border-border-interactive-light dark:border-border-interactive-dark";
  const note =
    status === "invalid"
      ? "Use 3 to 30 lowercase letters, numbers, _ or -, not starting or ending with _ or -."
      : status === "checking"
        ? "Checking..."
        : status === "available"
          ? `${username.trim().toLowerCase()} is available`
          : status === "taken"
            ? `${username.trim().toLowerCase()} is taken`
            : null;
  return (
    <View>
      <Heading>Make your profile</Heading>
      <View className="gap-4">
        <View className="gap-1">
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="Username"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoComplete="username"
            autoCorrect={false}
            maxLength={30}
            accessibilityLabel="Username"
            className={input}
          />
          {note ? (
            <Text
              accessibilityLiveRegion="polite"
              className={`font-ui text-xs px-2 ${
                status === "available"
                  ? "text-success-light dark:text-success-dark"
                  : status === "checking"
                    ? "text-text-tertiary-light dark:text-text-tertiary-dark"
                    : "text-error-light dark:text-error-dark"
              }`}
            >
              {note}
            </Text>
          ) : null}
        </View>
        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Display name"
          placeholderTextColor={colors.textTertiary}
          maxLength={80}
          accessibilityLabel="Display name"
          className={input}
        />
      </View>
    </View>
  );
}

export function FirstBookStep({
  books,
  loading,
  picked,
  setPicked,
}: {
  books: BookCard[];
  loading: boolean;
  picked: Set<string>;
  setPicked: (s: Set<string>) => void;
}) {
  const colors = useColors();
  return (
    <View>
      <Heading>Start with a great book</Heading>
      <Sub>Pick any that catch your eye, we'll add them to your Want to Read shelf.</Sub>
      {loading ? (
        <ActivityIndicator color={colors.brandUi} />
      ) : books.length === 0 ? (
        <Text style={{ fontFamily: Fonts.ui, fontSize: 13, color: colors.textTertiary }}>
          No starter books right now.
        </Text>
      ) : (
        <View className="flex-row flex-wrap" style={{ gap: 10 }}>
          {books.map((b) => {
            const active = picked.has(b.id);
            return (
              <Pressable
                key={b.id}
                onPress={() => {
                  const next = new Set(picked);
                  if (next.has(b.id)) next.delete(b.id);
                  else next.add(b.id);
                  setPicked(next);
                }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: active }}
                accessibilityLabel={`${b.title} by ${b.author}`}
                className="rounded-xl border overflow-hidden"
                style={{
                  width: "47%",
                  backgroundColor: active ? colors.bgSelected : colors.bgSurface,
                  borderColor: active ? colors.borderBrand : colors.borderSubtle,
                }}
              >
                <View
                  style={{
                    aspectRatio: 2 / 3,
                    backgroundColor: colors.bgSunken,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {b.coverUrl ? (
                    <Image
                      source={{ uri: b.coverUrl }}
                      style={{ width: "100%", height: "100%" }}
                      accessibilityRole="image"
                      accessibilityLabel={`${b.title} cover`}
                    />
                  ) : (
                    <BookOpen color={colors.textTertiary} size={22} />
                  )}
                </View>
                <View style={{ padding: 8 }}>
                  <Text
                    style={{
                      fontFamily: Fonts.uiMedium,
                      fontSize: 12,
                      color: colors.textPrimary,
                    }}
                    numberOfLines={2}
                  >
                    {b.title}
                  </Text>
                  <Text
                    style={{ fontFamily: Fonts.ui, fontSize: 10, color: colors.textTertiary }}
                    numberOfLines={1}
                  >
                    {b.author}
                  </Text>
                </View>
                {active ? (
                  <View
                    style={{
                      position: "absolute",
                      top: 6,
                      right: 6,
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: colors.brandUi,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Check color={colors.textOnBrand} size={12} weight="bold" />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <Text
      style={{
        fontFamily: Fonts.displayBold,
        fontSize: 24,
        color: colors.textPrimary,
        marginBottom: 6,
      }}
    >
      {children}
    </Text>
  );
}

function Sub({ children }: { children: React.ReactNode }) {
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
