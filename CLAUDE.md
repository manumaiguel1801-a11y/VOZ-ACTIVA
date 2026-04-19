# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install        # Install dependencies
npm run dev        # Start dev server at http://localhost:3000
npm run build      # Production build
npm run preview    # Preview production build
npm run lint       # Type-check with tsc --noEmit (no test runner configured)
npm run clean      # Remove dist/
```

There is no test framework configured in this project.

## Environment Setup

Copy `.env.example` to `.env.local` and set:
- `GEMINI_API_KEY` — required for the AI chat assistant (Gemini API)

Firebase configuration is loaded from `firebase-applet-config.json` (not an env variable). The Firestore database ID is also read from that file via `firebaseConfig.firestoreDatabaseId`.

## Architecture

**Stack:** React 19 + Vite 6 + TypeScript + Tailwind CSS v4 + Firebase + Gemini AI

The app is a mobile-first PWA for microbusiness owners (target: Colombian street vendors). The UI is entirely in Spanish.

### Application Flow

`App.tsx` is the root. It manages:
- Firebase Auth state via `onAuthStateChanged`
- User profile via a Firestore `onSnapshot` listener on `users/{uid}`
- A single `activeTab` state (type `Tab`) that drives which view renders inside `<Layout>`

If the user is not authenticated, it renders `<Auth>` instead of the main layout.

### Tab / View Mapping

| Tab value     | Component             | Description                          |
|---------------|-----------------------|--------------------------------------|
| `inicio`      | `Dashboard`           | Balance summary + weekly chart + recent transactions |
| `finanzas`    | `FinanceView`         | Financial reports/history            |
| `camara`      | `CameraView`          | Camera-based receipt/product scan    |
| `inventario`  | `InventorySalesView`  | Inventory and sales management       |
| `pasaporte`   | `PassportView`        | "Business passport" / credit profile |
| `perfil`      | `ProfileView`         | User profile editor                  |

Navigation is rendered by `<Layout>` as a fixed bottom nav bar. The floating `<ChatBubble>` (also inside Layout) opens the `<Chat>` component, which calls the Gemini service.

### Key Files

- `src/types.ts` — shared types: `Tab`, `Sale`, `Expense`, `Debt`, `InventoryProduct`, `UserProfile`
- `src/firebase.ts` — initializes Firebase app, exports `auth` and `db`
- `src/services/gemini.ts` — client-side Gemini wrapper for the in-app chat (different from the API-side version)
- `src/lib/utils.ts` — `cn()` helper (clsx + tailwind-merge)

### Firestore Data Model

Root document `users/{userId}` (ID = Firebase Auth UID) with fields: `firstName`, `lastName`, `idNumber`, `phone`, `birthDate`, `createdAt`, `email?`, `photoURL?`, `telegramChatId?`, `whatsappPhone?`, `linkCode?`, `verificationCode?`.

Subcollections under each user:
- `sales/` — `{ items: SaleItem[], total, createdAt, source }`
- `expenses/` — `{ concept, amount, items?, createdAt, source }`
- `debts/` — `{ name, concept, amount, type ('me-deben'|'debo'), status, amountPaid?, createdAt }`
- `inventario/` — `{ nombre, cantidad, precioCompra, precioVenta, createdAt, updatedAt? }`
- `scoreHistory/` — `{ score, weekKey, recordedAt }`

Messaging state (also on the user doc): `whatsappHistory`, `whatsappPendingState`, `telegramHistory`, `telegramPendingState`.

Rules in `firestore.rules` — users read/write only their own subtree. `passportVerifications/{code}` is publicly readable.

### Serverless API (Vercel)

`api/` contains Vercel serverless functions:
- `api/whatsapp.ts` — WhatsApp Business webhook. Handles account linking via `vincular <code>`, then routes to `processMessage` or the multi-turn `handlePendingState` state machine.
- `api/telegram.ts` — Telegram Bot webhook (same architecture).
- `api/_lib/gemini.ts` — **Server-side** Gemini client. Uses `gemini-2.5-flash` (fallback: `gemini-2.0-flash`) with structured JSON output enforced via `responseSchema`. This is separate from `src/services/gemini.ts`.
- `api/_lib/processMessage.ts` — Shared business logic for both bots: calls Gemini, maps parsed movement types to Firestore writes, handles inventory lookups and debt payments. Returns a `PendingState` when multi-turn input is needed (e.g., price for a new product).
- `api/_lib/whatsapp-bot.ts` / `api/_lib/telegram-bot.ts` — Thin send helpers.

Required env vars for the API (Vercel dashboard or `.env.local`):
- `GEMINI_API_KEY`
- `FIREBASE_SERVICE_ACCOUNT` (JSON string of Firebase Admin service account)
- `FIRESTORE_DATABASE_ID`
- `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`
- `TELEGRAM_BOT_TOKEN`

### Gemini AI Assistant

Two separate Gemini integrations with different purposes:

**Server-side** (`api/_lib/gemini.ts`): Used by Telegram/WhatsApp bots. Enforces structured JSON via `responseSchema`. Returns `{ message, data?, movements? }` where `data` is the primary `ParsedMovement` and `movements` contains secondary ones (multi-action messages). Model: `gemini-2.5-flash`.

**Client-side** (`src/services/gemini.ts`): Used by the in-app chat bubble. Sends conversation history and a system prompt, expects `{ message, data?: { type, amount, concept } }`. Model: `gemini-2.0-flash-exp` (injected via Vite `define` at build time).

Movement types parsed by Gemini: `venta`, `gasto`, `compra`, `deuda-me-deben`, `deuda-debo`, `pago-deuda-debo`, `cobro-deuda-me-deben`.

### Styling

- Tailwind CSS v4 loaded via `@tailwindcss/vite` plugin (no `tailwind.config.js`)
- Brand colors: gold `#B8860B` / `#FFD700` / `#DAA520`, cream background `#FDFBF0`, dark mode `#0D0D0D` / `#1A1A1A`
- Font: `Be Vietnam Pro` (body), `Plus Jakarta Sans` (headings)
- All components accept an `isDarkMode: boolean` prop and apply conditional classes via `cn()`
- Animations via `motion/react` (Framer Motion v12) with `AnimatePresence` for tab transitions
