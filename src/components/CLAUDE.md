# Components — Shared UI Components

Reusable UI components used across multiple screens. Each has co-located `.tsx` + `.scss`.

## Component Catalog

| Component | Purpose | Key Props |
|-----------|---------|-----------|
| `Button` | Canonical Arena button — 4 variants × 3 sizes, Oswald UPPERCASE | `variant?`, `size?`, `icon?`, `disabled?`, `type?` |
| `PageLayout` | Full-screen shell with topbar, back button, animated transitions | `title`, `onClose`, `onBack?`, `transition`, `zIndex` |
| `SegmentedToggle` | Multi-option toggle with sliding pill indicator | Generic `<T extends string>`, `value`, `onChange`, `options` |
| `DragNumberPicker` | Draggable number input (reps/sets picker) | `value`, `onChange`, `min`, `max`, `label` |
| `ExercisePicker` | Exercise type selector | `value`, `onChange` |
| `TimePicker` | Duration input (minutes:seconds) | `value`, `onChange` |
| `Avatar` | User avatar display with fallback | `user`, `size` |
| `PoseOverlay` | Skeleton visualization on OffscreenCanvas | `canvas`, `landmarks` |
| `PositionGuide` | Calibration position guide | `exerciseType`, `isCalibrating` |
| `FloatyNumbers` | Animated floating score numbers | `score`, `position` |
| `ErrorBoundary` | React error boundary with fallback UI | `fallback`, `children` |
| `AppLoader` | Full-screen splash/loading screen | — |
| `AchievementToast` | Single achievement notification | `achievement` |
| `AchievementToastQueue` | Queue manager for achievement toasts | `achievements[]` |
| `ReloadPrompt` | PWA update available prompt | — |

## Button Details

Canonical button primitive (`src/components/Button/Button.tsx`). Always reach for this before hand-rolling a button — the typography (Oswald 600 UPPERCASE letter-spacing 2px) and 16px radius are brand rules.

Variants (handoff spec):

| Variant | Background | Color | Border | Shadow |
|---|---|---|---|---|
| `primary` | `$gradient-ember-cta` | `#fff` | none | `$shadow-ember-glow` |
| `secondary` | `$card` | `$text` | `1px solid $line` | none |
| `ghost` | transparent | `$ember` | none | none |
| `danger` | `$blood` | `#fff` | none | blood-tinted |

Sizes (height / horizontal padding / font-size): `lg` 52/22/17, `md` 44/18/14, `sm` 36/14/12.

`type` defaults to `"button"` (not `"submit"`) — pass `type="submit"` explicitly inside forms. Disabled gets 0.4 opacity + no hover. Focus-visible shows a 2px ember outline at 2px offset.

## PageLayout Details

The most-used shared component. Provides:
- Fixed full-screen container with slide-in/slide-out animation
- Topbar: `[back button] [title] [optional right action]`
- Centered body column (max-width 480px)
- System back button integration via `useBackButton`

Two transition styles:
- `transition="slide"` — Push navigation (slide from right)
- `transition="sheet"` — Bottom sheet (slide from bottom)

`onBack` prop for in-place navigation (e.g., wizard steps). Bypasses exit animation entirely.

## SegmentedToggle Details

Type-safe generic component:
```tsx
<SegmentedToggle<'reps' | 'time'>
  value={mode}
  onChange={setMode}
  options={[
    { value: 'reps', label: 'Reps' },
    { value: 'time', label: 'Time', icon: <ClockIcon /> },
  ]}
/>
```

Sliding pill indicator uses CSS `calc()` for position/width based on active index and option count.
