import { useCreateList } from "@foxing/client";
import { useState } from "react";
import { Text, Pressable, ActivityIndicator, Alert, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useColors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { BackHeader } from "@/components/ui/back-header";
import { Screen } from "@/components/ui/screen";
import { ListFormFields } from "@/components/lists/list-form-fields";

export default function NewListScreen() {
  const colors = useColors();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const create = useCreateList();
  const saving = create.pending;

  async function save() {
    if (!title.trim()) return;
    const res = await create.run({
      title: title.trim().slice(0, 80),
      description: description.trim() || null,
      isPublic,
    });
    if (!res) {
      Alert.alert("Could not create the list", "Check your connection and try again.");
      return;
    }
    router.replace(`/lists/${res.list.id}` as never);
  }

  return (
    <Screen>
      <BackHeader title="New list">
        <Pressable
          onPress={() => void save()}
          disabled={saving || !title.trim()}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 999,
            backgroundColor: title.trim() ? colors.brandUi : colors.bgDisabled,
          }}
        >
          {saving ? (
            <ActivityIndicator color={colors.textOnBrand} size="small" />
          ) : (
            <Text
              style={{
                fontFamily: Fonts.uiMedium,
                color: colors.textOnBrand,
                fontSize: 13,
              }}
            >
              Create
            </Text>
          )}
        </Pressable>
      </BackHeader>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <ListFormFields
          title={title}
          onTitleChange={setTitle}
          description={description}
          onDescriptionChange={setDescription}
          descriptionPlaceholder="Description (optional)"
          isPublic={isPublic}
          onTogglePublic={() => setIsPublic((v) => !v)}
        />
      </ScrollView>
    </Screen>
  );
}
