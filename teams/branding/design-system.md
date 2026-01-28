# Design System — FUSE Creatine

## Color Palette

### Primary Colors

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| FUSE Red | `#ff3b30` | 255, 59, 48 | Primary brand, CTAs, "FUSE" in logo |
| White | `#ffffff` | 255, 255, 255 | Text on dark, backgrounds, "CREATINE" in logo |
| Dark | `#1a1a1a` | 26, 26, 26 | Primary backgrounds, text on light |

### Secondary Colors

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Gray 600 | `#666666` | 102, 102, 102 | Secondary text, muted elements |
| Gray 400 | `#999999` | 153, 153, 153 | Tertiary text, borders |
| Gray 200 | `#e5e5e5` | 229, 229, 229 | Dividers, subtle borders |

### Accent Colors

| Name | Hex | Usage |
|------|-----|-------|
| Success | `#34c759` | Positive states, confirmations |
| Warning | `#ff9500` | Caution states |
| Error | `#ff3b30` | Error states (same as FUSE Red) |

## Typography

### Font Stack

- **Primary**: System font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`)
- **Monospace**: `'SF Mono', 'Monaco', 'Inconsolata', monospace` (code, data)

### Type Scale

| Level | Size | Weight | Usage |
|-------|------|--------|-------|
| Display | 64px | 800 | Hero headlines |
| H1 | 48px | 700 | Page titles |
| H2 | 36px | 700 | Section headers |
| H3 | 24px | 600 | Subsection headers |
| Body Large | 18px | 400 | Lead paragraphs |
| Body | 16px | 400 | Standard text |
| Small | 14px | 400 | Captions, labels |
| Tiny | 12px | 500 | Tags, badges |

## Spacing

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Tight spacing |
| sm | 8px | Compact elements |
| md | 16px | Default spacing |
| lg | 24px | Section padding |
| xl | 32px | Major sections |
| 2xl | 48px | Page sections |
| 3xl | 64px | Hero sections |

## Components

### Buttons

- **Primary**: FUSE Red background, white text, rounded corners
- **Secondary**: Transparent, white border, white text
- **Ghost**: No background, text-only
- **Hover**: Slight scale (1.02), brightness increase

### Cards

- Dark background (`#1a1a1a` or `#111111`)
- Subtle border (`rgba(255,255,255,0.1)`)
- Rounded corners (12px)
- Hover: Border brightens

### Animations

- Use GSAP for complex animations
- Default easing: `power2.out`
- Scroll-triggered reveals: fade + slide up
- Hover transitions: 200ms ease

## Dark Mode (Default)

FUSE uses dark mode as default. The website and dashboards use dark backgrounds with light text. This reinforces the premium, scientific positioning.

## Imagery

- Product photography: Clean, minimal, dark backgrounds
- Hero images: Product in context (coffee cup, morning routine)
- Format: WebP with PNG fallback
- Asset location: `assets/`

## Logo Usage

- "FUSE" in FUSE Red (#ff3b30), "CREATINE" in white
- Minimum clear space: 1x logo height on all sides
- Never stretch, rotate, or recolor
- On light backgrounds: "FUSE" in red, "CREATINE" in dark
