// useWrite is Capsomer's mutation (capsomer/react/data) with optimistic patches that roll
// back on failure and a targeted refetch; only the words for a failed write are Foxing's.
import { useWrite as capsomerWrite, type WriteSpec } from "capsomer/react/data";
import { writeErrorMessage } from "./http";

export function useWrite<V = void, R = unknown>(spec: WriteSpec<V, R>) {
  return capsomerWrite(spec, writeErrorMessage);
}
