// Two seams every hook goes through, both Capsomer's (capsomer/react/data): useSeededQuery
// lets a web page start from its loader's data and then live in the cache like mobile
// does, and useWrite is a mutation with optimistic patches that roll back on failure and
// a targeted refetch. Only the words for a failed write stay Foxing's.
import { useWrite as capsomerWrite, type WriteSpec } from "capsomer/react/data";
import { writeErrorMessage } from "./http";

export {
  type Patch,
  type SeededResult,
  type WriteSpec,
  patch,
  patchAll,
  useSeededQuery,
} from "capsomer/react/data";

export function useWrite<V = void, R = unknown>(spec: WriteSpec<V, R>) {
  return capsomerWrite(spec, writeErrorMessage);
}
