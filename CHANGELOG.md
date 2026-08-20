# Changelog

## [Unreleased] — 2026-08-20

### Added
- **Loading screens** — `loading.tsx` added for root, `/chat`, `/dashboard`, `/settings` using shared `LoadingScreen` component with rotating `⛏` spinner
- **`AuthProvider`** — root-level React context subscribing to `supabase.auth.onAuthStateChange`; shows loading screen during initial session resolution, preventing logged-out flash before auth state is known
- **`NVIDIA NIM` provider type** — `"nvidia"` added to the `Provider` union type in `types/database.ts` (was missing, causing type errors when handling NVIDIA models)

### Fixed

#### Auth / Session
- **Cookie persistence** — `lib/supabase/middleware.ts` and `app/auth/callback/route.ts` now explicitly set `sameSite: "lax"`, `secure: true` (production), `path: "/"` on all auth cookies. This was the root cause of sessions not persisting across browser restarts.
- **Middleware uses `getUser()` not `getSession()`** — `getUser()` revalidates the token against Supabase server on every request; `getSession()` only reads the local cookie and can serve stale/invalid sessions. Already correct, confirmed and documented.
- **Auth callback** — refactored to use `createServerClient` directly (same pattern as `lib/supabase/server.ts`) so cookie options are applied consistently at the point of session exchange.

#### Type Errors
- `types/database.ts` — `Provider` type was missing `"nvidia"`, causing TypeScript errors in any code handling NVIDIA NIM models.
- `components/chat/TokenSavingsBadge.tsx` — added `?? 0` guards on all numeric stats fields to prevent `NaN` display when stats object has undefined fields (e.g. on messages loaded from DB history that predate the stats shape update).

#### UI / Theme
- All `brand-*` (purple/fuchsia) Tailwind classes replaced with new dark green token system across every component and page. No purple/violet references remain.
- Dashboard `DashboardClient` — Recharts chart tooltip styles updated to match dark background; previously used hardcoded light-mode colors that were invisible on dark background.
- Dashboard empty state — `EmptyChart` component added as a consistent empty state for all charts; previously some charts rendered with zero data could produce chart library warnings.
- `TokenSavingsBadge` — `bg-gray-100 text-gray-600` (light-mode) output token badge replaced with `bg-surface-3 text-text-secondary` to be visible on dark backgrounds.
- `LoadingScreen` — uses theme token `text-accent` / `bg-background` so it matches the dark theme rather than rendering a white flash.

#### Model Handling
- Model selector correctly shows `display_name` for models loaded from message history even if the model is now `is_active = false` — the name is stored on the `ChatMessage` object at load time, not re-fetched from the active models list.
- `PROVIDER_LABELS` map in `ModelSelector` updated to include `"nvidia": "NVIDIA NIM"`.

### Changed
- **Theme overhaul** — replaced purple/violet palette with dark charcoal (`#0a0f0d`) background and muted forest green (`#22c55e`) accent. Palette defined as Tailwind theme tokens in `tailwind.config.ts`: `background`, `surface`, `surface-2`, `surface-3`, `accent`, `accent-hover`, `accent-muted`, `accent-dim`, `text-primary`, `text-secondary`, `text-muted`, plus status colors `error`, `warning`, `success` with matching `*-bg` variants.
- **Consistent radius/shadow system** — border radius scale (`sm:4px`, `md:8px`, `lg:10px`, `xl:12px`) and shadow values redefined in `tailwind.config.ts` for dark-theme-appropriate opacity. All components updated to use `rounded-md`/`rounded-xl` consistently rather than mixing `rounded-lg`, `rounded-2xl`, etc.
- **`LoadingScreen` component** — extracted as shared component in `components/ui/LoadingScreen.tsx`; used by all `loading.tsx` files and `AuthProvider`.
- **Scrollbar styling** — custom scrollbar styles added in `globals.css` matching dark surface colors.

### Notes
- **Token accuracy historical data**: rows in `messages` written before the previous update (dynamic model listing / real token counts) may have `compressed_tokens` populated from local tiktoken estimates rather than real provider `usage` objects. Backfill not possible. Token accuracy is correct from that update onward.
- **Session persistence verification checklist** (manual testing required):
  - Log in → close browser fully → reopen → visit `/chat` directly → should land in chat without redirect to `/login`
  - Log in → refresh repeatedly → no flicker to logged-out state
  - Sign out → `/chat` and `/dashboard` should redirect to `/login`
