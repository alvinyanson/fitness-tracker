---
name: Kinetic Precision
colors:
  surface: '#111317'
  surface-dim: '#111317'
  surface-bright: '#37393d'
  surface-container-lowest: '#0c0e12'
  surface-container-low: '#1a1c1f'
  surface-container: '#1e2023'
  surface-container-high: '#282a2e'
  surface-container-highest: '#333539'
  on-surface: '#e2e2e7'
  on-surface-variant: '#b9cacb'
  inverse-surface: '#e2e2e7'
  inverse-on-surface: '#2e3034'
  outline: '#849495'
  outline-variant: '#3b494b'
  surface-tint: '#00dbe9'
  primary: '#dbfcff'
  on-primary: '#00363a'
  primary-container: '#00f0ff'
  on-primary-container: '#006970'
  inverse-primary: '#006970'
  secondary: '#c8c6c8'
  on-secondary: '#303032'
  secondary-container: '#474649'
  on-secondary-container: '#b7b4b7'
  tertiary: '#f8f5f8'
  on-tertiary: '#303032'
  tertiary-container: '#dbd9db'
  on-tertiary-container: '#5f5e61'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#7df4ff'
  primary-fixed-dim: '#00dbe9'
  on-primary-fixed: '#002022'
  on-primary-fixed-variant: '#004f54'
  secondary-fixed: '#e4e2e4'
  secondary-fixed-dim: '#c8c6c8'
  on-secondary-fixed: '#1b1b1d'
  on-secondary-fixed-variant: '#474649'
  tertiary-fixed: '#e4e2e4'
  tertiary-fixed-dim: '#c8c6c8'
  on-tertiary-fixed: '#1b1b1d'
  on-tertiary-fixed-variant: '#474649'
  background: '#111317'
  on-background: '#e2e2e7'
  surface-variant: '#333539'
typography:
  display-metrics:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 34px
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 26px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-padding: 20px
  stack-gap: 16px
  grid-gutter: 12px
  safe-area-bottom: 34px
---

## Brand & Style

The design system is built for a premium mobile fitness experience, targeting individuals who value data-driven health insights and professional-grade performance tracking. The brand personality is disciplined yet motivating—avoiding the cluttered "gamification" of entry-level apps in favor of a sophisticated, clinical-meets-athletic aesthetic.

The visual style is a hybrid of **Minimalism** and **Glassmorphism**. It prioritizes high-quality whitespace to reduce cognitive load during high-intensity workouts. Information density is managed through structural hierarchy, ensuring that critical vitals are glanceable while secondary metrics remain accessible. The emotional response should be one of calm focus, reliability, and precision.

## Colors

The palette is optimized for high-contrast visibility in varying light conditions (e.g., outdoor running or dimly lit gyms).

- **Primary (Electric Cyan):** Used exclusively for active states, progress indicators, and "Go" actions. It provides the "energy" within the dark interface.
- **Secondary (Deep Charcoal):** The primary canvas color. It reduces eye strain and makes the screen edges disappear on OLED devices.
- **Tertiary (Graphite):** Used for card backgrounds and elevated surfaces to create subtle structural depth.
- **Neutral (Crisp White):** Reserved for primary typography and essential icons to ensure maximum legibility.
- **Status Colors:** Success is rendered in the primary cyan, while warnings use a high-vibrancy amber and alerts use a pure crimson.

## Typography

This design system utilizes a three-font strategy to balance athleticism with technical precision.

**Hanken Grotesk** serves as the primary headline face, providing a contemporary, sharp look for health titles and large metric displays. **Inter** is used for all body text and UI controls for its exceptional readability at smaller scales. **JetBrains Mono** is introduced for technical data labels and timestamps, reinforcing the "precision instrument" feel of the application.

For workout screens, use `display-metrics` for the primary variable (e.g., Heart Rate). Use `label-caps` for all descriptors that sit above or below data points.

## Layout & Spacing

The layout follows a **Fluid Grid** model designed for mobile-first interaction. It utilizes a 4px baseline shift to maintain a strict vertical rhythm.

- **Margins:** Standard horizontal padding is 20px to prevent content from hitting the screen edge while maximizing data real estate.
- **Card Layouts:** Fitness metrics are housed in cards that span either full-width (1-column) or half-width (2-columns) with a 12px gutter.
- **Touch Targets:** All interactive elements maintain a minimum 44x44pt area.
- **Safe Areas:** High-intensity workout controls (Start/Pause/Stop) are anchored to the bottom safe area for easy thumb access.

### Breakpoints

The fluid grid resolves to three size classes, taken from the **smallest** window dimension so a class is stable across rotation (a 7" tablet is `tablet` in both orientations, and a landscape phone stays `phone`). These follow Android's `sw` resource qualifiers.

- **phone:** < 600dp. 20px horizontal padding, full-bleed content, 2-column stat grid.
- **tablet:** >= 600dp (~7"). 32px padding, content clamped to 640px, 4-column stat grid.
- **tabletLg:** >= 840dp (~10"). 40px padding, content clamped to 760px, 4-column stat grid.

A **two-pane master/detail** layout (History list beside the selected session's summary) appears at **720dp of current width** on a non-phone class - so a 7" tablet is single-pane in portrait and two-pane in landscape. The master pane is 320px (`tablet`) or 380px (`tabletLg`).

Tokens live in `src/theme/breakpoints.ts` and are read by screens only through `useResponsiveLayout`; no screen compares raw widths.

## Elevation & Depth

Hierarchy is established through **Tonal Layers** and **Glassmorphism** rather than traditional drop shadows.

- **Level 0 (Base):** Deep Charcoal (#1A1A1C).
- **Level 1 (Cards):** Graphite (#2C2C2E) with a subtle 1px inner border (opacity 10% white) to define edges.
- **Level 2 (Overlays/Modals):** A semi-transparent blur (Backdrop Filter: blur 20px) using the Graphite color at 80% opacity.
- **Active State:** Elements do not "lift" via shadows; instead, they utilize an outer glow (0px 0px 12px) using the Primary Electric Cyan at 30% opacity to indicate focus or active tracking.

## Shapes

The shape language is consistently **Rounded**, reflecting the organic nature of the human body while maintaining a professional structure.

- **Standard Cards:** Use `rounded-lg` (16px) for a soft, premium feel.
- **Interactive Buttons:** Use `rounded-xl` (24px) or fully pill-shaped for high-priority actions like "Start Workout."
- **Progress Rings:** Use a rounded stroke cap on all circular indicators to maintain the soft visual theme.
- **Selection Indicators:** Small accent bars used for active tabs should have 2px rounded corners.

## Components

### Progress Rings & Stat Cards

Progress rings should use a thick, secondary-colored track with a primary-colored active segment. The center of the ring displays the primary metric in `headline-lg`. Stat cards use the Level 1 elevation background with the label in `label-caps` positioned at the top left.

### Sleek Workout Controls

The "Primary Action" button (Start/Pause) is a large, pill-shaped button with a solid Electric Cyan background and black text. The "Secondary Action" (Stop/Lap) uses an outlined style with a 2px stroke.

### Connection Status

Status indicators for wearable devices use a small, pulsing Primary Cyan dot next to the device name in `label-sm`. If disconnected, the dot turns to a 10% white opacity "ghost" state.

### Lists & Inputs

Lists should be separated by 1px dividers in Tertiary Graphite. Input fields for health data (weight, height) use a "minimalist underline" style or a subtle Level 1 box with no border, using `body-lg` for the input value to ensure visibility.

### Chips

Used for workout tags (e.g., "Strength", "HIIT"). These are low-contrast: Graphite background with White text in `label-sm`, using a 12px corner radius.
