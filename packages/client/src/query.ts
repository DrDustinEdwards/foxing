// The data seams every hook goes through are Capsomer's (capsomer/react/data): a seeded query, and a
// write with optimistic cache patches that roll back on failure. Foxing adds only the words a failed
// write shows, from its API's errors.
import { useWrite as useCapsomerWrite, type WriteSpec } from "capsomer/react/data";
import { writeErrorMessage } from "./http";

export {
  patch,
  patchAll,
  useSeededQuery,
  type Patch,
  type SeededResult,
  type WriteSpec,
} from "capsomer/react/data";

export function useWrite<V = void, R = unknown>(spec: WriteSpec<V, R>) {
  return useCapsomerWrite(spec, writeErrorMessage);
}
