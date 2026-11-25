import { TextInput } from "react-native";
import { useColors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { VisibilityToggle } from "@/components/ui/visibility-toggle";

export function ListFormFields({
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  descriptionPlaceholder,
  isPublic,
  onTogglePublic,
}: {
  title: string;
  onTitleChange: (v: string) => void;
  description: string;
  onDescriptionChange: (v: string) => void;
  descriptionPlaceholder: string;
  isPublic: boolean;
  onTogglePublic: () => void;
}) {
  const colors = useColors();
  return (
    <>
      <TextInput
        value={title}
        onChangeText={onTitleChange}
        placeholder="Title"
        placeholderTextColor={colors.textTertiary}
        maxLength={80}
        style={{
          fontFamily: Fonts.uiMedium,
          fontSize: 16,
          color: colors.textPrimary,
          backgroundColor: colors.bgSurface,
          borderColor: colors.borderSubtle,
          borderWidth: 1,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 12,
        }}
      />
      <TextInput
        value={description}
        onChangeText={onDescriptionChange}
        placeholder={descriptionPlaceholder}
        placeholderTextColor={colors.textTertiary}
        multiline
        maxLength={500}
        style={{
          fontFamily: Fonts.body,
          fontSize: 14,
          color: colors.textPrimary,
          backgroundColor: colors.bgSurface,
          borderColor: colors.borderSubtle,
          borderWidth: 1,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
          minHeight: 80,
          textAlignVertical: "top",
        }}
      />
      <VisibilityToggle isPublic={isPublic} onToggle={onTogglePublic} publicLabel="Public list" />
    </>
  );
}
