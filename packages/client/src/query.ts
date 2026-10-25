// Two seams every hook goes through. useSeededQuery lets a web page start from its
// loader's data (server-rendered, no loading flash) and then live in the cache like
// mobile does. useWrite is a mutation with optimistic cache patches that roll back
// on failure and a targeted refetch of only the keys the write touched, so a save
// never reloads the page.
import {
  type QueryClient,
  type QueryKey,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { writeErrorMessage } from "./http";

/** With a seed the data is never undefined, so a seeded page reads `.data` directly. */
export type SeededResult<T, S> = [S] extends [T]
  ? UseQueryResult<T> & { data: T }
  : UseQueryResult<T>;

export function useSeededQuery<T, S extends T | undefined = undefined>(
  options: { queryKey: QueryKey; queryFn: () => Promise<T>; enabled?: boolean },
  seed?: S,
): SeededResult<T, S> {
  const qc = useQueryClient();
  const [seededAt] = useState(() => Date.now());
  const query = useQuery<T>({
    ...options,
    ...(seed !== undefined ? { initialData: seed, initialDataUpdatedAt: seededAt } : {}),
  });
  // A loader that re-runs (navigation, a search param) hands down a newer object;
  // it replaces what the cache holds for the same key.
  const last = useRef(seed);
  const key = JSON.stringify(options.queryKey);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the serialized key stands in for options.queryKey.
  useEffect(() => {
    if (seed !== undefined && seed !== last.current) {
      last.current = seed;
      qc.setQueryData(options.queryKey, seed);
    }
  }, [seed, key, qc]);
  return query as SeededResult<T, S>;
}

/** A cache patch: the key and how its data changes. Missing data stays missing. */
export type Patch = readonly [QueryKey, (old: never) => unknown, boolean];

/** Patches the one query at exactly this key: keys are prefixes, and ["library"] must
 *  not reach ["library", "book", id], whose data has another shape. */
export function patch<T>(key: QueryKey, update: (old: T) => T): Patch {
  return [key, update as (old: never) => unknown, true];
}

/** Patches every query under this prefix; each one must hold data of the same shape. */
export function patchAll<T>(prefix: QueryKey, update: (old: T) => T): Patch {
  return [prefix, update as (old: never) => unknown, false];
}

async function applyPatches(qc: QueryClient, patches: readonly Patch[]): Promise<() => void> {
  const saved: Array<[QueryKey, unknown]> = [];
  for (const [key, update, exact] of patches) {
    await qc.cancelQueries({ queryKey: key, exact });
    for (const [k, data] of qc.getQueriesData({ queryKey: key, exact })) {
      saved.push([k, data]);
      if (data !== undefined) qc.setQueryData(k, (update as (old: unknown) => unknown)(data));
    }
  }
  return () => {
    for (const [k, data] of saved) qc.setQueryData(k, data);
  };
}

export interface WriteSpec<V, R> {
  write: (vars: V) => Promise<R>;
  /** Applied before the request goes out; rolled back if it fails. */
  optimistic?: (vars: V) => readonly Patch[];
  /** Refetched once the write settles (prefix match). */
  invalidates?: (vars: V, result: R | undefined) => readonly QueryKey[];
  onSuccess?: (result: R, vars: V) => void;
}

export function useWrite<V = void, R = unknown>(spec: WriteSpec<V, R>) {
  const qc = useQueryClient();
  const m = useMutation<R, unknown, V, { rollback: () => void }>({
    mutationFn: spec.write,
    onMutate: async (vars) => ({
      rollback: await applyPatches(qc, spec.optimistic?.(vars) ?? []),
    }),
    onError: (_err, _vars, ctx) => ctx?.rollback(),
    onSuccess: (result, vars) => spec.onSuccess?.(result, vars),
    onSettled: (result, _err, vars) => {
      for (const key of spec.invalidates?.(vars, result) ?? []) {
        void qc.invalidateQueries({ queryKey: key });
      }
    },
  });
  const { mutate, mutateAsync } = m;
  /** Resolves to the result, or undefined when the write failed (shown in `error`). */
  const run = useCallback(
    (vars: V): Promise<R | undefined> =>
      mutateAsync(vars).then(
        (r) => r,
        () => undefined,
      ),
    [mutateAsync],
  );
  /** Fire and forget; the error shows through `error`. */
  const fire = useCallback((vars: V) => mutate(vars), [mutate]);
  return {
    run,
    fire,
    pending: m.isPending,
    error: writeErrorMessage(m.error),
    reset: m.reset,
  };
}
