# Screens — Full-Screen View Conventions

## Structure

Each screen lives in its own directory with co-located SCSS:
```
ScreenName/
  ScreenName.tsx
  ScreenName.scss
  SubComponent/
    SubComponent.tsx
    SubComponent.scss
```

## PageLayout

Most screens use `<PageLayout>` for consistent topbar + animation:

```tsx
<PageLayout title="Title" onClose={onClose} zIndex={200} transition="slide">
  {children}
</PageLayout>
```

- **`transition="slide"`** (default) — Slide from right (push nav)
- **`transition="sheet"`** — Slide from bottom (modal sheet)
- **`onBack`** — Optional in-place back handler (for wizards). Bypasses exit animation.
- **`rightAction`** — Optional topbar right slot
- **`bodyClassName`** — Extra class on body container

## Lazy Loading

Screens and modals are lazy-loaded in their parent via `React.lazy()` + `<Suspense>`:

```tsx
const StatsScreen = lazy(() => import('@screens/StatsScreen/StatsScreen').then(m => ({ default: m.StatsScreen })));
```

- **App.tsx** lazy-loads: WorkoutConfigScreen, RestScreen, SummaryScreen, LevelUpScreen
- **StartScreen** lazy-loads: AuthModal, ProfileScreen, FriendsScreen, SavedWorkoutsScreen, QuickSessionModal, StatsScreen, QuestsScreen

## Animation Pattern

Screens use the `useModalClose` hook for exit animations:

```tsx
const { closing, handleClose, handleAnimationEnd } = useModalClose(onDone);

return (
  <div className={`my-screen${closing ? ' my-screen--exit' : ''}`}
       onAnimationEnd={handleAnimationEnd}>
```

Or they delegate to `<PageLayout>` which handles this internally.

## Component Conventions

- Props interface named `ScreenNameProps`, destructured in function signature
- Import order: React → types → domain/exercises → hooks/context → components → styles
- Sections marked with comments: `{/* ── Section Name ── */}`
- Conditional rendering with ternary/&&, not if-else JSX
- Inline styles only for dynamic values (CSS custom properties). Static styles in SCSS.
- Multi-phase animations: `phase` state enum drives class like `.card--enter`, `.card--roll`, `.card--show`

## Screen List

| Screen | Purpose | Entry point |
|--------|---------|-------------|
| StartScreen | Home hub (HUD, quests, stats, actions) | Default idle state |
| WorkoutConfigScreen | Multi-exercise builder wizard | "Multi-Set Workout" button |
| RestScreen | Between-set rest timer | SET_COMPLETE (not last) |
| SummaryScreen | Post-workout results | MANUAL_STOP / workout complete |
| LevelUpScreen | Level-up celebration | After summary if level increased |
| StatsScreen | Detailed statistics | Stats widget / ProfileScreen hub |
| QuestsScreen | Quest journal | Quest widget / ProfileScreen hub |
| ProgressionScreen | Achievements & levels | ProfileScreen hub |
| ProfileScreen | Auth-only navigation hub (PlayerCard hero + menu) | Avatar tap on PlayerHUD |
| FriendsScreen | Friends list + Activity Feed (2 internal tabs) | ProfileScreen hub items / `#friends` deep-link |
| SavedWorkoutsScreen | Saved workout templates (load → config) | ProfileScreen hub featured card / WorkoutConfigScreen |
