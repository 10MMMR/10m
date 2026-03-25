<!-- # Design System

## Purpose

This document is the source of truth for the repo's UI language. Use it when designing new screens, revising existing components, or reviewing UI work.

## Design Summary

The system is a **minimalist modern** style with a warm, premium feel:

- clean structure and generous whitespace
- one strong signature accent gradient
- subtle texture and depth instead of flat surfaces
- deliberate asymmetry to avoid generic layouts
- restrained motion that makes the interface feel alive
- dual-font typography with clear hierarchy

The goal is to feel **professional, design-forward, and memorable** without becoming busy or ornamental.

## Visual Principles

- Use minimal color variety, but make the accent color feel decisive.
- Prefer visual contrast through section inversion rather than heavy borders.
- Add depth with layered shadows, soft glows, and light texture.
- Break perfect symmetry in important areas such as hero, featured cards, and pricing.
- Keep layouts responsive and calm, with strong hierarchy on every screen size.

## Core Tokens

### Colors

- `background`: `#FDFCF8`
- `foreground`: `#2C2C24`
- `muted`: `#F0EBE5`
- `muted-foreground`: `#78786C`
- `accent`: `#5D7052`
- `accent-secondary`: `#C18C5D`
- `accent-foreground`: `#F3F4F1`
- `border`: `#DED8CF`
- `card`: `#FEFEFA`
- `ring`: `#5D7052`

### Signature Gradient

Use the Moss Green to Terracotta gradient as the primary accent:

```css
linear-gradient(to right, #5D7052, #C18C5D)
```

Use it sparingly, but with clear intent, on:

- primary buttons
- headline highlights
- icon backgrounds
- featured card strokes
- badges and accent bars

## Typography

- **Display font:** `Calistoga`
  - Use for hero headlines and major section headings.
  - Keep it expressive and sparse.
- **Body/UI font:** `Inter`
  - Use for body copy, labels, inputs, and most interface text.
- **Monospace font:** `JetBrains Mono`
  - Use for section labels, badges, and technical callouts.

Rules:

- Use strong hierarchy.
- Keep body text highly readable.
- Let the display font carry personality, but not overload the page.

## Spacing And Layout

- Use generous section padding and calm whitespace.
- Keep containers centered and content widths restrained.
- Prefer dense, cohesive spacing inside cards and components.
- Use asymmetrical grids where they create tension without harming clarity.

Recommended patterns:

- hero: left-weighted text column with a lighter visual column
- feature sections: content-first layouts with controlled offsets
- highlighted sections: use inverted backgrounds to create rhythm

## Surfaces And Depth

- Cards should feel warm, elevated, and tactile.
- Use soft borders and subtle shadows rather than hard edges.
- Favor layered depth over strong outlines.
- Use texture carefully so the UI does not feel flat or sterile.

Useful treatments:

- dot pattern overlays on dark sections
- faint radial glows in section corners
- gradient-tinted shadows for featured elements
- gradient borders for highlighted cards

## Component Language

### Buttons

- Primary buttons use the signature gradient.
- Secondary buttons stay quiet and structural.
- Hover states should lift slightly and deepen shadow.
- Active states should feel tactile and restrained.

### Cards

- Default cards should be warm white with soft borders.
- Featured cards can use gradient borders or stronger shadow.
- Hover states should subtly elevate the surface.

### Inputs

- Use clear borders, comfortable height, and visible focus rings.
- Keep placeholder text muted.
- Maintain accessible contrast at all times.

### Section Labels

Use a consistent pill badge at the start of major sections:

- rounded shape
- small accent dot
- uppercase monospace text
- light tinted background

## Motion

Motion should support comprehension, not dominate the interface.

- Keep transitions smooth and short.
- Use hover lifts, gentle fades, and subtle staggered reveals.
- Continuous animation should be slow and understated.
- Respect `prefers-reduced-motion`.

If a motion library is not already part of the implementation, prefer CSS transitions and keyframes before adding one.

## Accessibility

- Maintain WCAG-friendly contrast.
- Keep focus states visible and consistent.
- Ensure touch targets are large enough for mobile use.
- Avoid motion that flashes, loops aggressively, or distracts from content.

## Implementation Notes

- Centralize tokens through CSS custom properties.
- Keep components composable and locally consistent with the existing codebase.
- Prefer reusing shared UI patterns over introducing one-off styles.
- When the design system and existing codebase differ, preserve the repo's established architecture while adapting the visual layer. -->
