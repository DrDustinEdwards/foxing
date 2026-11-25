import { type ReactNode } from "react";
import { type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

interface ScreenProps {
  children: ReactNode;
  edges?: readonly Edge[];
  className?: string;
  style?: StyleProp<ViewStyle>;
}

const DEFAULT_EDGES: readonly Edge[] = ["top", "bottom"];

export function Screen({ children, edges = DEFAULT_EDGES, className, style }: ScreenProps) {
  return (
    <SafeAreaView
      edges={edges}
      className={`flex-1 bg-bg-base-light dark:bg-bg-base-dark${className ? ` ${className}` : ""}`}
      style={style}
    >
      {children}
    </SafeAreaView>
  );
}
