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

- `src/types.ts` — shared types: `Tab`, `Transaction`, `UserProfile`
- `src/firebase.ts` — initializes Firebase app, exports `auth` and `db`
- `src/services/gemini.ts` — wraps `@google/genai` SDK; sends chat history + system prompt to `gemini-3-flash-preview`; expects JSON responses with optional `data` field (type, amount, concept)
- `src/lib/utils.ts` — `cn()` helper (clsx + tailwind-merge)

### Firestore Data Model

Single collection `users/{userId}` (document ID = Firebase Auth UID). Fields: `firstName`, `lastName`, `idNumber`, `phone`, `birthDate`, `createdAt` (required), `email` (optional). Users can read/write only their own document; delete is disabled. Rules are in `firestore.rules`.

### Gemini AI Assistant

The chat assistant (`src/services/gemini.ts`) uses a system prompt that instructs the model to:
1. Extract financial movements (ventas, gastos, deudas) from natural language
2. Respond in JSON: `{ message: string, data?: { type, amount, concept } }`
3. Adapt its tone to match the user's register (professional → costeño Colombian slang)

The Vite config injects `GEMINI_API_KEY` into `process.env` at build time via `define`.

### Styling

- Tailwind CSS v4 loaded via `@tailwindcss/vite` plugin (no `tailwind.config.js`)
- Brand colors: gold `#B8860B` / `#FFD700` / `#DAA520`, cream background `#FDFBF0`, dark mode `#0D0D0D` / `#1A1A1A`
- Font: `Be Vietnam Pro` (body), `Plus Jakarta Sans` (headings)
- All components accept an `isDarkMode: boolean` prop and apply conditional classes via `cn()`
- Animations via `motion/react` (Framer Motion v12) with `AnimatePresence` for tab transitions
