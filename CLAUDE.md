# Foxing Monorepo

## Structure
apps/mobile, Expo React Native app
apps/web, Next.js web platform
packages/types, shared TypeScript types
packages/utils, shared utilities

## Commands

From repo root:
  pnpm install          install all dependencies
  pnpm dev:mobile       start Expo mobile app
  pnpm dev:web          start Next.js web app
  pnpm type-check       type-check both apps

From apps/mobile:
  npx expo start --clear
  npx eas update --channel preview --message "..."
  npx eas build --profile preview --platform android

From apps/web:
  pnpm dev
  pnpm build

## Rules (always)
- No em dashes anywhere. Ever.
- No cheesy copy. Read ai-writing-tells.md in the Foxing Vault.
- All colors via design tokens (CSS custom properties on web, useColors() on mobile)
- All AI calls server-side via Supabase Edge Function
- npx tsc --noEmit must be clean before any OTA or deploy
- Read context.md from the Foxing Vault before any session
