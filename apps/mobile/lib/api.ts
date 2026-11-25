import { expoClient } from "@better-auth/expo/client";
import NetInfo from "@react-native-community/netinfo";
import { createApiClient, createFoxingQueryClient, keys } from "@foxing/client";
import { focusManager, onlineManager } from "@tanstack/react-query";
import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";
import { AppState } from "react-native";
import { enqueue, flush, type SyncTransport } from "./sync-queue";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://foxing.app";

export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [
    expoClient({ scheme: "foxing", storagePrefix: "foxing", storage: SecureStore }),
    emailOTPClient(),
  ],
});

let lastCookie = "";

async function sessionHeaders(): Promise<Record<string, string>> {
  lastCookie = await authClient.getCookie();
  return lastCookie ? { Cookie: lastCookie } : {};
}

// React Native's WebSocket takes request headers as a third argument (the club live
// socket needs the session cookie); the DOM type the compiler also loads does not.
const NativeWebSocket = WebSocket as unknown as new (
  url: string,
  protocols: null,
  options: { headers: Record<string, string> },
) => WebSocket;

export const api = createApiClient({
  baseUrl: API_URL,
  headers: sessionHeaders,
  credentials: "omit",
  openSocket: (url) =>
    new NativeWebSocket(url, null, { headers: lastCookie ? { Cookie: lastCookie } : {} }),
});

export const queryClient = createFoxingQueryClient();

onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(!!state.isConnected)),
);
AppState.addEventListener("change", (state) => focusManager.setFocused(state === "active"));

const syncTransport: SyncTransport = async (path, init) =>
  fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "omit",
    headers: { ...(init.headers as Record<string, string>), ...(await sessionHeaders()) },
  });

export async function syncNow(): Promise<void> {
  const { pushed } = await flush(syncTransport);
  if (pushed === 0) return;
  for (const key of [
    keys.library,
    keys.stats,
    keys.streak,
    keys.vocabulary,
    keys.diary,
    ["annotations"],
  ]) {
    void queryClient.invalidateQueries({ queryKey: key });
  }
}

onlineManager.subscribe((online) => {
  if (online) void syncNow();
});

export async function queueWrite(input: Parameters<typeof enqueue>[0]): Promise<string> {
  const id = await enqueue(input);
  void syncNow();
  return id;
}
