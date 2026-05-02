# Styles — Arena Design System

**Aesthetic**: dark-mode obsidian + ember. Cinematic, combat-arena tone. Not generic dark — committed to ember/gold accents, display-font UPPERCASE titles, and ember glow halos.

## SCSS Architecture

```
src/styles/
  tokens/           # design tokens (prefer these over legacy)
    _color.scss     # obsidian/ember/gold/good/purple/blood/ice
    _typography.scss
    _spacing.scss
    _radius.scss
    _shadow.scss
    _motion.scss
    _layout.scss
    _gradient.scss
    _index.scss     # @forward's the above
  mixins/
    _surface.scss   # card-surface, glass, corner-frame
    _glow.scss      # ember-glow, ember-text-glow, top-highlight
    _text.scss      # title-screen, kicker, micro, caption, body, etc.
    _motion.scss
    _hex.scss
    _a11y.scss
    _legacy.scss    # deprecated — do not use in new code
    _index.scss
  _variables.scss   # legacy shim — re-exports tokens for back-compat
  _buttons.scss
  _animations.scss
  _forms.scss
  _reset.scss
  main.scss
```

**Import pattern** (modern): `@use 'tokens' as *;` + `@use 'mixins' as *;`. The SCSS `loadPaths` includes `src/styles/` so partials resolve by name.

**Legacy `@use 'variables' as *;` still works** but new code should prefer `tokens`.

## Color Tokens — use semantically, never decoratively

### Surfaces (obsidian family)
- `$obsidian: #0c0a10` — app background
- `$obsidian-2: #15121c` — secondary surface
- `$card: #1c1829` — elevated card surface
- `$line: rgba(255,255,255,0.08)` — hairline borders

### Foreground
- `$text: #f5f2ff` — primary foreground
- `$dim: #a8a2bc` — muted text, WCAG AA on obsidian

### Ember (primary accent)
- `$ember: #ff7a47` — titles, active accents, CTAs, primary icons
- `$ember-solid: #ff5a1f` — saturated fills behind white text
- `$ember-deep: #c43b0e` — bottom of ember CTA gradient

### Semantic — strict usage
- `$gold: #f5c871` — **rewards only**: XP, levels, achievements, ranks
- `$good: #4ae8a0` — **success only**: completed quests, validations
- `$purple: #bb8cff` — tertiary accent, grade S, quest details (sparingly)
- `$blood: #ff5577` — **semantic only**: grade D, error states
- `$ice: #7fc5ff` — **semantic only**: grade B

### Grades
S=purple, A=gold, B=ice, C=ember, D=blood. Matches `domain/achievements.ts` tier colors (`#cd7f32` bronze, `#c0c0c0` silver, `#ffd700` gold, `#00e5ff` platinum).

## Typography — display UPPERCASE + ember glow

Three families:
- `$font-display: 'Oswald', 'Bebas Neue', Impact` — titles, hero numbers, grade letters (ALWAYS UPPERCASE)
- `$font-sans: 'Inter'` — body, captions
- `$font-mono: 'JetBrains Mono'` — kicker, micro, numeric values (`font-variant-numeric: tabular-nums`)

Use the **text mixins** (`src/styles/mixins/_text.scss`) instead of hand-rolling:
- `@include title-screen` — 22px ember Oswald UPPERCASE `letter-spacing: 2px`. **Screen titles MUST use this.**
- `@include title-xl | title-l | title-m` — section/card titles
- `@include hero-number` — 62px Oswald for grades and hero numbers
- `@include kicker` — 10px mono UPPERCASE ls:3px dim
- `@include micro` — 9px mono UPPERCASE ls:2px
- `@include body` — 14px Inter
- `@include caption` — 12px Inter dim

Ember title glow: `@include ember-text-glow` → `text-shadow: 0 0 12px rgba(255,122,71,0.3)`. Use on display-font UPPERCASE titles in ember.

## Spacing — 4/8/12/16/18/22/26/32

`$space-xs:4`, `$space-sm:8`, `$space-md:12`, `$space-lg:16`, `$space-xl:18`, `$space-2xl:22`, `$space-3xl:26`, `$space-4xl:32`

Legacy `$spacing-*` aliases still resolve but new code uses `$space-*`.

## Radius — 8/12/16/18/22/pill

`$radius-sm:8`, `$radius-md:12`, `$radius-lg:16`, `$radius-xl:18`, `$radius-2xl:22`, `$radius-pill:999`

Default card radius = `$radius-2xl`. Tight chips/badges = `$radius-sm`. Pills = `$radius-pill`.

## Shadows — ember-first

- `$shadow-ember-glow` / `-lg` — ember CTA shadows with inset top-highlight
- `$shadow-card-raise` — `0 12px 32px rgba(255,122,71,0.2)` (ember-tinted card lift)
- `$shadow-modal-sheet` — `0 -20px 60px rgba(0,0,0,0.8)` for bottom sheets

## Motion — Arena easing

- `$ease-arena: cubic-bezier(0.2, 0.9, 0.3, 1)` — Arena-specific, confident snap
- `$ease-out-expo`, `$ease-out-back`, `$ease-default` also available

Key Arena keyframes (in `_animations.scss`):
- `arena-screen-in` — 600ms translate+blur entrance
- `arena-modal-slide-up` — 350ms
- `arena-skeleton-pulse` — 800ms opacity
- `arena-shimmer` — ember tint sweep (card shine)
- `arena-ember-pulse` — active CTA pulse (box-shadow oscillation)
- `arena-xp-count-up` — 900ms XP reveal

## Key Mixins

| Mixin | Purpose |
|---|---|
| `card-surface($radius)` | Obsidian card + hairline border + ember-tinted raise shadow |
| `surface-subtle($radius)` | `$obsidian-2` divider surface |
| `glass($bg, $blur)` | Blurred overlay (bottom sheets) |
| `corner-frame($color, $size, $thickness, $inset)` | 4 L-shaped ember corners (Arena decoration) |
| `ember-glow`, `ember-glow-lg` | CTA box-shadow presets |
| `ember-text-glow($intensity)` | Text glow for ember titles |
| `top-highlight` | Inset white top edge for CTAs |
| `flex-center($direction)` | Flex centering |
| `fill` | `position: absolute; inset: 0` |

## Arena Patterns — learned from PUS-10 refonte

### Card surface (dark)
```scss
.my-card {
    background: $card;
    background-image: linear-gradient(135deg,
        color-mix(in srgb, #{$ember} 12%, transparent) 0%,
        color-mix(in srgb, #{$gold} 8%, transparent) 100%
    );
    border: 1px solid color-mix(in srgb, #{$ember} 22%, transparent);
    border-radius: $radius-2xl;
    box-shadow: $shadow-card-raise;
}
```

### Hover lift (ember)
```scss
.my-card {
    transition: border-color 200ms ease, transform 180ms $ease-arena,
                box-shadow 200ms ease;
    &:hover,
    &:focus-visible {
        border-color: $ember;
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(0,0,0,0.45),
                    0 0 16px rgba(255,122,71,0.15);
        outline: none;
    }
}
```

### Ember badge / chip
```scss
.my-badge {
    @include micro;
    padding: 2px 8px;
    border-radius: $radius-sm;
    background: color-mix(in srgb, #{$ember} 12%, transparent);
    border: 1px solid color-mix(in srgb, #{$ember} 30%, transparent);
    color: $ember;
}
```

### Staggered entrances
`animation: arena-xp-count-up 0.4s $ease-arena both; animation-delay: calc(var(--i, 0) * 50ms);` — set `--i` inline on each item.

## Gotchas — don't repeat these mistakes

- **Don't hand-roll buttons.** The canonical button API is `<Button />` (`src/components/Button/Button.tsx`) — 4 variants (`primary` / `secondary` / `ghost` / `danger`) × 3 sizes (`lg` / `md` / `sm`), Oswald 600 UPPERCASE letter-spacing 2px, 16px radius. The recipe is a brand rule (handoff spec). Reach for it before writing any new button SCSS; if the variant you need is genuinely missing, extend the component rather than reinventing the styling at the call site. The dashed-ember `wc-add-block-btn` is grandfathered as an "add slot" affordance distinct from a button; everything else is a `<Button />`.

- **`overflow: hidden` on a card clips ember text-shadow glows.** If your card has an ember title with `text-shadow: 0 0 12px`, don't put `overflow: hidden` on the card just to contain a decorative `::before`. `position: absolute; inset: 0` on the `::before` is already self-clamped — the parent doesn't need `overflow: hidden`.
- **Children of `.page-body` (flex-column) compress without `flex-shrink: 0`.** PageLayout's body is `flex: 1; display: flex; flex-direction: column`. Hero cards, sticky headers, and category sections inside a scrollable quest list must set `flex-shrink: 0` or they shrink below natural height on short viewports.
- **Screen titles must use `@include title-screen`.** Don't hand-roll — letter-spacing, uppercase, ember color, and line-height are a spec.
- **Gold is only for rewards.** XP bars, level rings, achievements, ranks. Never as a decorative accent — ember is the primary, gold is the prize.
- **`good` is only for completion.** A checked-off quest, a validated streak day. Not for generic "positive" UI.
- **Deprecated Sass color functions** (`lighten()`, `darken()`): forbidden. Use `color-mix(in srgb, ...)` or `sass:color` module.
- **No magic z-indexes.** Use the scale in `tokens/_layout.scss` (or legacy `$z-base`…`$z-maximum`).

## Mobile Breakpoints

`@media (max-width: 480px)` — primary mobile (iPhone 13 mini / Android medium)
`@media (max-width: 430px)` — tight mobile (iPhone 12 mini class)
`@media (max-width: 360px)` — narrow Android
`@media (max-width: 320px)` — iPhone SE 1st gen

**Priority**: scale text + tighten spacing. Amputate content (hide labels, collapse to icons) only at ≤360/≤320 where structural parity with desktop is no longer feasible. Keep chevrons, CTAs, and icons visible down to ≤430 whenever possible.

## Class Naming

Prefix-based BEM: `.rest-card-header`, `.quests-header-title`, `.quest-widget-badge--compact`. State: `.is-active`. Variants: `--exit`, `--sheet`, `--danger`, `--compact`, `--wide`.

## Dark Mode

**Arena IS the theme.** The whole app is dark. No light-mode parallel implementation.
