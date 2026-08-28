---
name: StreamHub
colors:
  surface: '#111417'
  surface-dim: '#111417'
  surface-bright: '#37393d'
  surface-container-lowest: '#0b0e11'
  surface-container-low: '#191c1f'
  surface-container: '#1d2023'
  surface-container-high: '#272a2e'
  surface-container-highest: '#323538'
  on-surface: '#e1e2e7'
  on-surface-variant: '#cdc2d8'
  inverse-surface: '#e1e2e7'
  inverse-on-surface: '#2e3134'
  outline: '#968da1'
  outline-variant: '#4b4455'
  surface-tint: '#d5baff'
  primary: '#d5baff'
  on-primary: '#42008a'
  primary-container: '#9147ff'
  on-primary-container: '#fffcff'
  inverse-primary: '#7926e7'
  secondary: '#d3fbff'
  on-secondary: '#00363a'
  secondary-container: '#00eefc'
  on-secondary-container: '#00686f'
  tertiary: '#ffb779'
  on-tertiary: '#4c2700'
  tertiary-container: '#af6100'
  on-tertiary-container: '#fffcff'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ecdcff'
  primary-fixed-dim: '#d5baff'
  on-primary-fixed: '#270057'
  on-primary-fixed-variant: '#5e00c1'
  secondary-fixed: '#7df4ff'
  secondary-fixed-dim: '#00dbe9'
  on-secondary-fixed: '#002022'
  on-secondary-fixed-variant: '#004f54'
  tertiary-fixed: '#ffdcc1'
  tertiary-fixed-dim: '#ffb779'
  on-tertiary-fixed: '#2e1500'
  on-tertiary-fixed-variant: '#6c3a00'
  background: '#111417'
  on-background: '#e1e2e7'
  surface-variant: '#323538'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 48px
  layout-margin: 24px
  layout-gutter: 16px
---

## Brand & Style

The design system is engineered for a premium, high-performance live-streaming experience. It prioritizes content immersion by utilizing a "Dark-First" philosophy, where the interface recedes into the background to let high-definition video and vibrant creator content lead the visual hierarchy.

The style is **Modern / Tech-Focused** with a touch of **Glassmorphism**. It balances professional reliability with the high-energy pulse of live gaming and creative broadcasts. The aesthetic is defined by high-contrast accents against deep neutral surfaces, utilizing subtle translucency and precise linework to create a sense of architectural depth without visual clutter.

**Key Principles:**
- **Immersion:** Minimized interface interference during active viewing.
- **Energy:** Use of high-chroma accents to signal "Live" states and urgent interactions.
- **Precision:** Tight, systematic alignment and refined typography reflecting a developer-grade performance.

## Colors

The palette is anchored in a multi-tiered dark grey to avoid pure black fatigue while maintaining deep contrast.

- **Primary (Electric Purple):** Used for primary actions, brand moments, and active navigation states.
- **Secondary (Neon Cyan):** Used for secondary highlights, verification badges, and interactive "hype" elements.
- **Background (#0B0E11):** The foundation for all pages; provides a void-like canvas for content.
- **Surface (#181A1B):** Used for cards, sidebars, and elevated containers.
- **Live Signal (#FF4B4B):** A dedicated high-visibility red reserved exclusively for "LIVE" status indicators and critical alerts.
- **Border/Stroke:** A subtle `#2B2E30` is used for 1px definition on surfaces.

## Typography

This design system utilizes **Inter** for all primary UI and content delivery due to its exceptional legibility at small sizes and its neutral, modern character. For technical data, timestamps, and viewer counts, **JetBrains Mono** is introduced to provide a "dashboard" feel that resonates with the gaming and creator community.

- **Headlines:** Use Bold (700) or SemiBold (600) weights with slight negative letter-spacing to create a compact, high-impact look.
- **Body:** Regular (400) weight is standard. Ensure 1.5x line height for readability in dense chat environments.
- **Labels:** Use Medium (500) weight in monospaced font for metadata to differentiate it from user-generated text.

## Layout & Spacing

The layout utilizes a **12-column fluid grid** for the main content area, with fixed-width sidebars for navigation (collapsed: 64px, expanded: 240px) and chat (340px).

- **Spacing Rhythm:** Based on a 4px baseline. Most UI elements should utilize `md` (16px) for internal padding.
- **Chat Density:** In the chat UI, vertical spacing is reduced to `xs` (4px) or `sm` (8px) to maximize information density.
- **Breakpoints:**
  - **Mobile (<768px):** Sidebars hidden; bottom navigation bar; single column content.
  - **Tablet (768px - 1280px):** Collapsed navigation; fluid content; optional chat.
  - **Desktop (>1280px):** Expanded navigation; fluid content; fixed chat sidebar.

## Elevation & Depth

This design system uses **Tonal Layering** combined with **Subtle Outlines** instead of heavy shadows to maintain a clean, flat aesthetic.

- **Level 0 (Base):** `#0B0E11` - Used for the main background.
- **Level 1 (Surface):** `#181A1B` - Used for cards, chat containers, and sidebars. Should have a 1px solid border of `#2B2E30`.
- **Level 2 (Hover/Overlay):** `#25282A` - Used for tooltips, dropdown menus, and hover states on cards.
- **Glassmorphism:** Navigation headers use a backdrop-blur (20px) with 80% opacity of the Base color to provide context of scroll position.
- **Shadows:** Only used on floating modals; 24px blur, 10% opacity black, no offset.

## Shapes

The shape language is consistently "Soft-Modern." 

- **Standard Elements:** Buttons, inputs, and small cards use `rounded` (0.5rem / 8px).
- **Containers:** Large stream thumbnails and main sections use `rounded-lg` (1rem / 16px).
- **Interactive Icons:** Circular containers for avatars and status indicators to contrast against the geometric grid.
- **Badges:** "LIVE" and category tags use a smaller `4px` radius to maintain a compact, "tab-like" appearance.

## Components

### Buttons
- **Primary:** Background: Primary Purple; Text: White; Weight: 600. No shadow.
- **Secondary:** Border: 1px Solid Primary Purple; Background: Transparent; Hover: 10% Opacity Primary Purple.
- **Ghost:** Transparent background; Text: Gray-400; Hover: Surface color.

### Stream Thumbnails
- **Image:** 16:9 aspect ratio with `rounded-lg`.
- **Live Badge:** Top-left overlay; Background: Accent Live Red; Text: "LIVE" in Label-sm (Caps).
- **Viewer Count:** Bottom-left overlay; Black 50% opacity pill with JetBrains Mono text.

### Chat UI
- **Message:** Compact layout. Username in bold (varying colors per user) followed by a colon and the message. 
- **Input:** 1px border; Background: Base; Placeholder: Gray-500.

### Avatars
- **Status Ring:** 2px offset ring. Green for Online, Red for Live, Gray for Offline.

### Inputs
- **Default:** Background: `#181A1B`; Border: 1px solid `#2B2E30`.
- **Focus:** Border: 1px solid Primary Purple; Glow: Subtle 2px purple outer spread.