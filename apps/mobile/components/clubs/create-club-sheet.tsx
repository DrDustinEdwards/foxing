import { useCreateClub } from "@foxing/client";
import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { X as XIcon, CaretLeft, CaretRight } from "phosphor-react-native";
import { SheetError } from "@/components/ui/form-field";
import { SheetScaffold } from "@/components/ui/sheet-scaffold";
import { useColors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import {
  BasicsStep,
  BookStep,
  type CreatedClub,
  type DraftState,
  InviteStep,
  PaceStep,
} from "./create-club-steps";

type Step = "basics" | "book" | "pace" | "invite";
const STEP_ORDER: Step[] = ["basics", "book", "pace", "invite"];

const EMPTY_DRAFT: DraftState = {
  name: "",
  description: "",
  isPublic: true,
  book: null,
  pace: "chill",
};

interface CreateClubSheetProps {
  visible: boolean;
  onClose: () => void;
  onCreated?: (clubId: string) => void;
}

export function CreateClubSheet({ visible, onClose, onCreated }: CreateClubSheetProps) {
  const colors = useColors();
  const [step, setStep] = useState<Step>("basics");
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const createClub = useCreateClub();
  const resetCreateClub = createClub.reset;
  const submitting = createClub.pending;
  const [created, setCreated] = useState<CreatedClub | null>(null);
  const error = createClub.error ? "Couldn't create the club. Try again." : null;

  useEffect(() => {
    if (visible) {
      // oxlint-disable-next-line react/set-state-in-effect -- resets the sheet each time it opens
      setStep("basics");
      setDraft(EMPTY_DRAFT);
      setCreated(null);
      resetCreateClub();
    }
  }, [visible, resetCreateClub]);

  const idx = STEP_ORDER.indexOf(step);
  const isLast = step === "invite";
  const canAdvance = step === "basics" ? draft.name.trim().length >= 2 : true;

  const goNext = useCallback(async () => {
    if (step === "pace") {
      if (created) return setStep("invite"); // Back from Invite: the club already exists
      const res = await createClub.run({
        name: draft.name.trim(),
        description: draft.description.trim() || undefined,
        currentBookId: draft.book?.id,
        readingPace: draft.pace,
        visibility: draft.isPublic ? "public" : "private",
      });
      if (!res) return;
      const club = { ...res.club, name: draft.name.trim(), isPublic: draft.isPublic };
      setCreated(club);
      setStep("invite");
      return;
    }
    if (isLast) {
      if (created) onCreated?.(created.id);
      onClose();
      return;
    }
    setStep(STEP_ORDER[idx + 1]);
  }, [createClub, created, draft, idx, isLast, onClose, onCreated, step]);

  const goBack = useCallback(() => {
    if (idx === 0) {
      onClose();
      return;
    }
    setStep(STEP_ORDER[idx - 1]);
  }, [idx, onClose]);

  return (
    <SheetScaffold
      visible={visible}
      onClose={onClose}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      header={
        <>
          <View className="flex-row items-center justify-between px-3 py-2">
            <Pressable onPress={goBack} hitSlop={10} className="p-2 flex-row items-center">
              {idx === 0 ? (
                <XIcon color={colors.textPrimary} size={20} />
              ) : (
                <CaretLeft color={colors.textPrimary} size={20} />
              )}
            </Pressable>
            <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textSecondary }}>
              New Club · {idx + 1}/{STEP_ORDER.length}
            </Text>
            <View style={{ width: 36 }} />
          </View>
          <StepBar count={STEP_ORDER.length} index={idx} />
        </>
      }
      footer={
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={goBack}
            className="px-4 py-2 rounded-full"
            style={{ opacity: idx === 0 ? 0 : 1 }}
            disabled={idx === 0}
            accessibilityLabel="Back"
          >
            <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textSecondary }}>Back</Text>
          </Pressable>
          <Pressable
            onPress={() => void goNext()}
            disabled={!canAdvance || submitting}
            className="flex-row items-center gap-1 px-5 py-2 rounded-full"
            style={{
              backgroundColor: canAdvance ? colors.brandUi : colors.bgDisabled,
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? (
              <ActivityIndicator color={colors.textOnBrand} size="small" />
            ) : (
              <>
                <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textOnBrand }}>
                  {isLast ? "Done" : step === "pace" ? "Create" : "Continue"}
                </Text>
                {!isLast ? <CaretRight color={colors.textOnBrand} size={14} weight="bold" /> : null}
              </>
            )}
          </Pressable>
        </View>
      }
    >
      {step === "basics" ? (
        <BasicsStep draft={draft} setDraft={setDraft} />
      ) : step === "book" ? (
        <BookStep draft={draft} setDraft={setDraft} />
      ) : step === "pace" ? (
        <PaceStep draft={draft} setDraft={setDraft} />
      ) : (
        <InviteStep club={created} />
      )}
      {error ? <SheetError message={error} /> : null}
    </SheetScaffold>
  );
}

function StepBar({ count, index }: { count: number; index: number }) {
  const colors = useColors();
  return (
    <View className="flex-row gap-1 px-4 mb-2">
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 3,
            borderRadius: 2,
            backgroundColor: i <= index ? colors.brandUi : colors.borderSubtle,
          }}
        />
      ))}
    </View>
  );
}
