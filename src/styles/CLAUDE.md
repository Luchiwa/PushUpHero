# Styles — Design Tokens & Conventions

## SCSS Architecture

- `_variables.scss` — All design tokens exported as both SCSS vars and CSS custom properties on `:root`
- `_mixins.scss` — Reusable mixins (layout, glass, badges, cards, effects)
- `_buttons.scss` — Button variants (`.btn-primary`, `.btn-secondary`, `.btn-icon`, `.btn-danger`)
- `_animations.scss` — Global keyframes (`screen-in`, `card-in`, `slide-up`, `fade-in-down`)
- `_reset.scss` — Browser reset
- `_forms.scss` — Form element styles

Components import tokens via `@use 'variables' as *` and `@use 'mixins' as *` (loadPaths includes `src/styles/`).

## Color Palette

### Brand
- `$accent: #ff7f00` (orange — primary CTA, workout identity)
- `$accent-light: #ff9c35`, `$accent-pale: #ffb366`, `$accent-dark: #e67300`

### Semantic
- `$green: #22c55e` / `$green-dark: #16a34a`
- `$amber: #f59e0b` / `$amber-light: #fbbf24` / `$amber-dark: #d97706`
- `$red: #ef4444`
- `$blue: #3b82f6`
- `$purple: #a855f7`
- `$indigo: #6366f1`

### Surfaces
- `$bg: #ffffff`, `$white: #ffffff`, `$black: #000000`
- `$text: #1a1a1a`, `$text-muted: rgba($text, 0.6)`
- `$border: rgba($text, 0.1)`, `$surface: rgba($accent, 0.08)`

### Tiers (must match `TIER_COLORS` in `domain/achievements.ts`)
- Bronze `#cd7f32`, Silver `#c0c0c0`, Gold `#ffd700`, Platinum `#00e5ff`

### Grades (WCAG AA contrast >= 4.5:1)
- S `#7c3aed`, A `#16a34a`, B `#1d4ed8`, C `#b45309`, D `#dc2626`

## Spacing Scale
`$spacing-xs: 4px`, `$spacing-sm: 8px`, `$spacing-md: 16px`, `$spacing-lg: 24px`, `$spacing-xl: 32px`

## Border Radius
`$radius-xs: 6px`, `$radius-sm: 12px`, `$radius: 20px`, `$radius-lg: 32px`, `$radius-pill: 100px`

**No `$radius-md`** — use `$radius-sm` (12px) or `$radius` (20px) instead.

## Z-Index Scale
`$z-base: 1`, `$z-content: 2`, `$z-raised: 5`, `$z-overlay: 10`, `$z-sticky: 40`, `$z-modal-backdrop: 100`, `$z-modal: 200`, `$z-notification: 300`, `$z-toast: 1000`, `$z-maximum: 9999`

## Typography
`$font-xs: 0.72rem`, `$font-sm: 0.8rem`, `$font-md: 0.9rem`, `$font-base: 0.95rem`, `$font-lg: 1.15rem`, `$font-xl: 1.5rem`, `$font-2xl: 2.5rem`, `$font-3xl: 3rem`

## Easing Curves
- `$ease-default: cubic-bezier(0.4, 0, 0.2, 1)` — Standard transitions
- `$ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1)` — Screen entrances, card slides
- `$ease-out-back: cubic-bezier(0.34, 1.56, 0.64, 1)` — Bouncy pops

## Transitions & Shadows
- `$transition: 0.3s $ease-default`, `$transition-fast: 0.15s ease`
- `$shadow-md`, `$shadow-card`, `$shadow-modal`, `$shadow-accent-sm`, `$shadow-accent-glow`
- `$gradient-accent`, `$gradient-accent-rich`, `$gradient-danger`, `$gradient-green`

## Key Mixins

| Mixin | Purpose |
|-------|---------|
| `flex-center($direction)` | Flex centering |
| `fill` | `position: absolute; inset: 0` |
| `glass($bg, $blur)` | Glassmorphism (backdrop-filter + border) |
| `hover-lift($shadow, $y)` | Card hover pattern |
| `badge($bg, $text, $shape)` | Inline pill/tag badge |
| `grade-badge($size, $font)` | Grade square (S/A/B/C/D) |
| `tier-card-variants` | `.tier-{name}` classes with tier-specific styling |
| `modal-overlay($z, $blur, $bg)` | Full-screen overlay |
| `modal-card($width, $padding)` | Modal card with slide-in |
| `shimmer($radius)` | Skeleton loading |
| `text-gradient($gradient)` | Text clipped to gradient |
| `text-truncate` | Ellipsis overflow |

## Conventions

- **Color-mix pattern**: Use `color-mix(in srgb, $color X%, transparent)` for tinted backgrounds, borders, and shadows from CSS custom properties. Never use deprecated `lighten()`/`darken()`.
- **CSS custom properties**: Set inline via `style={{ '--kpi-color': '#ff7f00' } as CSSProperties}` for dynamic theming. Read in SCSS via `var(--kpi-color)`.
- **White card pattern**: `background: $white; background-image: linear-gradient(135deg, color-mix(in srgb, $color 8%, transparent) 0%, color-mix(in srgb, $color 2%, transparent) 50%, transparent 100%); border: 1px solid color-mix(in srgb, $color 22%, transparent);`
- **Hover lift**: `transform: translateY(-2px)` + deepened gradient + `color-mix` shadow
- **Staggered entrances**: `animation-delay: calc(var(--i, 0) * 50ms)` with `$ease-out-expo`
- **Class naming**: Prefix-based BEM (`.rest-card-header`, `.rest-stat-value`). State: `.is-active`. Variants: `--exit`, `--sheet`, `--danger`.
- **No dark mode** yet, but token architecture supports it.
