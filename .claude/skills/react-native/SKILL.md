---
name: react-native
description: Authoring and auditing standards for React Native + Expo code. Activate when writing, reviewing, or refactoring any React Native / Expo (SDK 50+) project — components, navigation, state, native modules, or performance work. Enforces TypeScript strict mode, Expo Router, EAS, and the production/security checklist below.
---

# React Native & Expo Engineering Skill

> System instruction for Claude Code. When this skill is active, treat the rules below as **mandates**, not suggestions. If existing code violates them, flag it; if you are writing new code, comply. When a mandate conflicts with a clearly intentional project convention, surface the conflict to the user instead of silently picking one.

---

## 1. PURPOSE & SCOPE

**Activate this skill when** the task involves any of:

- A repository containing `app.json` / `app.config.{js,ts}`, an `expo` dependency, or `react-native` in `package.json`.
- Writing, reviewing, refactoring, or debugging React Native or Expo code (components, screens, hooks, navigation, native modules, build config).
- Designing app architecture, state management, navigation, or performance strategy for a mobile/universal RN app.

**Do NOT apply** these rules to plain React web projects (Next.js, Vite, CRA) — they share JSX but not the platform constraints. If a project is React Native Web _inside_ an Expo app, this skill still applies.

**Before writing code:** verify the exact installed Expo SDK version (`package.json` → `expo`) and read the **version-pinned** docs at `https://docs.expo.dev/versions/v<MAJOR>.0.0/`. Expo APIs change meaningfully between SDKs; never rely on memory for API shapes, plugin config, or deprecations.

---

## 2. TECH STACK MANDATES (Modern React Native & Expo)

### Required

- **Expo SDK (latest stable)** — managed/CNG workflow. New native capability is added via **config plugins**, not by hand-editing `ios/` / `android/`.
- **Expo Router** for all navigation — file-based routing under `app/` (or `src/app/`). Use typed routes (`experiments.typedRoutes: true`).
- **EAS** for builds and submissions — `eas build`, `eas submit`, `eas update` (OTA). No local-only release pipelines; commit `eas.json`.
- **TypeScript strict mode** — `"strict": true` in `tsconfig.json`. No untyped JS in app code.
- **Modern ES2024+** — `async/await`, optional chaining (`?.`), nullish coalescing (`??`), top-level destructuring, immutable updates.

### Banned (flag on sight)

| Banned pattern                                                                               | Use instead                                                              |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Bare/legacy **React Navigation** wired by hand (`@react-navigation/*` as the primary router) | **Expo Router** (built on React Navigation, but file-based)              |
| **Class components** / lifecycle methods (`componentDidMount`, etc.)                         | Functional components + Hooks                                            |
| **Manual native linking** / editing `Podfile`, `MainActivity`, `Info.plist` directly         | **Config plugins** + prebuild (CNG)                                      |
| `any` types, `// @ts-ignore` without justification                                           | Precise types; `// @ts-expect-error` with a comment if truly unavoidable |
| `react-native-async-storage` for secrets/tokens                                              | `expo-secure-store`                                                      |
| Ejecting to bare workflow to "fix" a plugin                                                  | Author/patch a config plugin                                             |
| Deprecated APIs flagged in the SDK changelog                                                 | Their documented replacement                                             |

---

## 3. CODING STYLES & CONVENTIONS

### Component structure

- **Functional components only**, declared as `const Name = (props): ReactElement => { ... }` (arrow syntax) or `function Name()` for the default-exported screen — be consistent within a file.
- **Explicit prop types.** Define a `type Props = { ... }` (or `interface`) and annotate the component. Never rely on inference for the public surface. No `React.FC` (it muddies `children` typing) — type props directly.
- **One component per file** for screens and significant components; small presentational helpers may be colocated.
- **Hooks at the top**, early-returns after, JSX last. Extract non-trivial logic into custom `useX` hooks.
- **No inline anonymous components** in `render` / `renderItem` — they remount every render.

```tsx
type Props = {
  title: string;
  onPress: () => void;
};

export const PrimaryButton = ({ title, onPress }: Props): ReactElement => {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.button}>
      <Text style={styles.label}>{title}</Text>
    </Pressable>
  );
};
```

### Styling architecture

**This project uses `StyleSheet.create` (React Native built-in).** Do not introduce NativeWind/Tailwind, styled-components, tamagui, or any other styling library without an explicit decision to migrate.

- Define all styles via `StyleSheet.create` at **module scope** (one `styles` object per file), referenced by key.
- **No inline literal style objects** (`style={{ margin: 8 }}`) in hot paths — they allocate a new object every render. For dynamic styles, combine a static base with a small computed override via an array: `style={[styles.base, isActive && styles.active]}`.
- Share colors, spacing, and typography through a central tokens/theme module rather than repeating literals across files.

### Absolute pathing

- **Always use the `@/` alias** for intra-project imports; ban deep relative chains (`../../../`).
- Configure in `tsconfig.json` (`compilerOptions.paths`) and ensure the Metro/Babel resolver agrees (`babel-plugin-module-resolver` or Expo's built-in alias support).

```ts
// tsconfig.json
"paths": { "@/*": ["./src/*"] }
```

```tsx
import { PrimaryButton } from '@/components/primary-button'; // ✅
import { PrimaryButton } from '../../../components/primary-button'; // ❌
```

---

## 4. PRODUCTION STANDARDS & SECURITY

### State management

Choose by data ownership — do **not** put server data in client state stores:

| Concern                                                 | Tool                                         | Rule                                                                                                                                     |
| ------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Server / async state** (fetching, caching, mutations) | **TanStack Query** (`@tanstack/react-query`) | All network reads go through queries with proper `queryKey`s; mutations invalidate keys. No manual `useEffect` + `useState` fetch loops. |
| **Global client state** (auth, theme, UI prefs)         | **Zustand**                                  | Small, selector-based stores. Subscribe with selectors to avoid whole-store re-renders.                                                  |
| **Localized / dependency-injected state**               | **Context API**                              | Only for low-frequency values (theme, locale, current user). Never for high-frequency updates — Context re-renders all consumers.        |

- Never duplicate server data into Zustand/Context "to be safe" — it desyncs. TanStack Query is the cache.
- Keep state colocated to the lowest component that needs it; lift only when shared.

### Performance

- **Lists:** use **`@shopify/flash-list`** (`FlashList`) for any list that can grow beyond a screenful or is data-driven. **Ban `ScrollView` with `.map()`** for dynamic/large data, and prefer `FlashList` over `FlatList` for large datasets. Provide `estimatedItemSize`; give items a stable `keyExtractor`; keep `renderItem` referentially stable.
- **Memoization (apply deliberately, not reflexively):**
  - `useCallback` for any function passed to a memoized child or used as an effect dependency or list `renderItem`.
  - `useMemo` for expensive computations or to stabilize object/array props passed to memoized children.
  - `React.memo` on pure presentational components rendered in lists or hot paths.
  - Do **not** wrap trivial values — needless memoization adds overhead and noise. With the React Compiler enabled, prefer letting it handle this and reserve manual memoization for measured hot paths.
- **Images:** use **`expo-image`** (`Image`) with `contentFit`, explicit dimensions, `placeholder`/`transition`, and caching. Never ship unbounded full-resolution remote images; size to the rendered box.
- **Render hygiene:** stable keys (never array index for dynamic lists), avoid inline object/array/function literals as props to memoized children, defer non-critical work with `InteractionManager` / `requestAnimationFrame`. Run animations on the UI thread (Reanimated worklets), not via `setState`.

### Security

- **Sensitive data → `expo-secure-store`** (Keychain / Keystore): auth tokens, refresh tokens, PII, credentials. Never `AsyncStorage`, never plain files, never Redux/Zustand persisted to disk unencrypted.
- **No hardcoded secrets.** API keys/endpoints come from `expo-constants` (`extra`) / EAS environment variables / `.env` via `app.config.ts`. Anything bundled into the JS is **public** — treat client keys as non-secret and keep true secrets server-side behind an API.
- **Transport:** HTTPS only; validate/parse all server responses (e.g. `zod`) before trusting them.
- **Deep links & auth callbacks:** validate scheme and params; never execute or trust unvalidated link payloads.
- **Logging:** never log tokens, secrets, or PII. Strip verbose logs from production builds.

---

## 5. CODE REVIEW & AUDIT CHECKLIST

When auditing or reviewing RN/Expo code, walk this checklist explicitly and report findings by category with file/line references. Mark each as ✅ pass / ⚠️ risk / ❌ violation.

### Memory leaks

- [ ] Every `useEffect` with a subscription, timer, listener, or async task returns a **cleanup function** (clears timers, unsubscribes, aborts fetches).
- [ ] No `setState` after unmount — async resolutions guarded (e.g. `AbortController`, mounted flag, or TanStack Query which handles this).
- [ ] Event listeners (`AppState`, `Dimensions`, `Keyboard`, navigation, native emitters) are removed on unmount.
- [ ] No closures capturing large objects retained by long-lived listeners/stores.

### Unnecessary re-renders

- [ ] Components in lists / hot paths are `React.memo`'d where props are stable.
- [ ] No inline object/array/function literals passed to memoized children.
- [ ] Context is not carrying high-frequency state; Zustand subscriptions use selectors.
- [ ] `useMemo`/`useCallback` dependency arrays are correct (no missing or over-broad deps).
- [ ] Derived values are computed, not stored in redundant state that must be kept in sync.

### Unhandled edge cases

- [ ] Loading, empty, and **error** states rendered for every async/data view (not just the happy path).
- [ ] Network failures, timeouts, and offline are handled; retries/backoff where appropriate.
- [ ] Null/undefined and empty arrays handled before `.map()` / property access.
- [ ] Permissions (camera, location, notifications) request + denied + "never ask again" paths handled.
- [ ] Platform branches (`Platform.OS`) covered for both iOS and Android; web path considered if RN Web is in scope.

### Layout shifts & visual stability

- [ ] Lists use `FlashList` with a correct `estimatedItemSize`; images reserve space (explicit width/height) to prevent reflow.
- [ ] Safe-area insets respected (`react-native-safe-area-context`), not hardcoded paddings.
- [ ] No content jump on data load — skeletons/placeholders hold layout.
- [ ] Keyboard avoidance handled (`KeyboardAvoidingView` / appropriate behavior) without shifting unrelated UI.
- [ ] Font loading (`expo-font`) gated by splash screen so text doesn't flash/reflow.

### Conventions & security (cross-cutting)

- [ ] TypeScript strict; no `any` / unexplained `@ts-ignore`.
- [ ] Imports use `@/` alias, not deep relatives.
- [ ] No class components, manual native linking, or banned patterns from §2.
- [ ] Secrets in `expo-secure-store`; no hardcoded keys; responses validated.
- [ ] Accessibility: interactive elements have `accessibilityRole`/labels; touch targets adequate.
