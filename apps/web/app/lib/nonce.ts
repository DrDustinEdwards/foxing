// The render's CSP nonce, handed from app/entry.server.tsx to the root Layout. Undefined in the
// browser: the nonce matters only in the server HTML, and browsers hide it from the DOM anyway.
import { createContext, useContext } from "react";

export const NonceContext = createContext<string | undefined>(undefined);

export function useNonce(): string | undefined {
  return useContext(NonceContext);
}
