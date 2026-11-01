---
name: Veludo & Cacau
colors:
  surface: '#fdf9f3'
  surface-dim: '#dddad4'
  surface-bright: '#fdf9f3'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f7f3ed'
  surface-container: '#f1ede7'
  surface-container-high: '#ebe8e2'
  surface-container-highest: '#e6e2dc'
  on-surface: '#1c1c18'
  on-surface-variant: '#4f4441'
  inverse-surface: '#31302d'
  inverse-on-surface: '#f4f0ea'
  outline: '#817470'
  outline-variant: '#d3c3be'
  surface-tint: '#73594f'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#291710'
  on-primary-container: '#9b7d73'
  inverse-primary: '#e1bfb3'
  secondary: '#735c00'
  on-secondary: '#ffffff'
  secondary-container: '#fed65b'
  on-secondary-container: '#745c00'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#351000'
  on-tertiary-container: '#b47457'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbcf'
  primary-fixed-dim: '#e1bfb3'
  on-primary-fixed: '#291710'
  on-primary-fixed-variant: '#594138'
  secondary-fixed: '#ffe088'
  secondary-fixed-dim: '#e9c349'
  on-secondary-fixed: '#241a00'
  on-secondary-fixed-variant: '#574500'
  tertiary-fixed: '#ffdbcc'
  tertiary-fixed-dim: '#ffb695'
  on-tertiary-fixed: '#351000'
  on-tertiary-fixed-variant: '#6c3920'
  background: '#fdf9f3'
  on-background: '#1c1c18'
  surface-variant: '#e6e2dc'
typography:
  headline-xl:
    fontFamily: Playfair Display
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Playfair Display
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Playfair Display
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 38px
  headline-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Playfair Display
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  title-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
  title-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
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
  gutter: 1rem
  gutter-sm: 0.75rem
  gutter-lg: 1.25rem
  margin: 1rem
  margin-sm: 0.75rem
  margin-lg: 1.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

### Brand Personality & Philosophy
This design system defines an artisanal, warm, and distinctly approachable luxury experience for mobile commerce. It bridges the gap between mass-market confectionery and bespoke chocolaterie, balancing deep sensory indulgence with intuitive everyday usability. The visual language conveys warmth, melt-in-the-mouth richness, and meticulous craft without feeling exclusionary or cold.

### Emotional Response
Interactions should evoke an immediate tactile "appetite appeal," comfort, and trust. Every screen communicates generous hospitality, evoking the visual richness of freshly tempered chocolate, golden ribbon wrappings, and velvety confectionery boxes.

### Aesthetic Movement: Warm Tactile Elegance
The visual language merges **Tactile Depth** with **Warm Editorial Modernism**:
- **Tactile Softness:** Generous radii, velvety surfaces, and chocolate-tinted ambient shadows create an edible physical presence.
- **Editorial Distinction:** Classical serif headlines contrast against crisp, high-legibility geometric body text.
- **Gold-Accented Hierarchy:** Restrained, purposeful uses of metallic warmth for loyalty tiers, gift packaging, awards, and primary calls-to-action.

## Colors

The palette reproduces the sensory spectrum of roasting, melting, and packaging fine chocolate.

### Core Swatches & Roles
- **Marrom Cacau Intenso (`#26140D` - Primary):** Serves as the primary anchor for headers, primary action buttons, high-emphasis text, and base container elements. Meets WCAG AAA contrast against cream grounds.
- **Dourado Real (`#D4AF37` - Secondary):** Reserved for prestige seals, loyalty milestones, primary conversion triggers, and promotional accents. Supported by **Dourado Brilhante (`#F3CE65`)** for badges, stars, and pressed states.
- **Marrom Caramelo / Canela Quente (`#8C5338` - Tertiary):** Handles secondary labels, decorative borders, active state highlights, and category badges.
- **Marrom Chocolate ao Leite (`#4E2816` - Accent/Surface Heavy):** Applied to secondary headings, subtle banners, and contextual card borders.
- **Fundo Creme Aveludado (`#FAF6F0` - Canvas Neutral):** The universal background color, reducing eye strain while providing a warm, milky canvas.
- **Creme Suave (`#F2E9DE` - Surface Variant):** Used for elevated cards, nested input areas, drawer backgrounds, and grouped module tiles.

### Accessibility Matrix
- Text on `#FAF6F0` and `#F2E9DE` must utilize `#26140D` (Contrast Ratio > 14:1, exceeding WCAG AAA) or `#4E2816` (Contrast Ratio > 8.5:1).
- Interactive `#D4AF37` elements carrying text must use `#26140D` for typographic content to ensure a minimum contrast ratio of 7.2:1.
- Error states utilize a rich cocoa-crimson (`#8B1E1E`), warning uses deep amber (`#A05E03`), and success defaults to evergreen cocoa leaf (`#20542C`).

## Typography

The typographic system creates an interplay between luxury artisanal tradition and high-speed mobile clarity.

### Pairing Strategy
- **Playfair Display (Headlines):** Used exclusively for editorial product names, storytelling statements, seasonal collection titles, and promotional hero banners. Brings the elegance of boutique packaging and culinary craftsmanship into the digital interface.
- **Inter (Body, Controls, Numbers, Microcopy):** Ensures optical clarity, tall x-height, and legibility for descriptions, nutritional specs, pricing, and checkout forms under varying lighting conditions.

### Scaling & Readability Rules
- Large headlines adjust dynamically for small phone displays (`headline-xl-mobile` and `headline-lg-mobile`) to prevent single-word hyphenation and orphan lines.
- Product price tags must always be rendered in `Inter` with SemiBold or Bold weight (`title-md` or `title-lg`), paired with currency symbols aligned to baseline to guarantee scanning speed.
- All body text enforces minimum font sizes of 14px for general descriptions and 12px for supporting legal notes or weight indicators.

## Layout & Spacing

### Mobile-First Layout Model
The layout utilizes a fluid 4-column system optimized for single-hand reach and natural thumb paths on touch devices (360px to 430px wide viewports).

- **Margins & Gutters:** Base canvas margin is set to `1rem` (16px), stepping up to `1.5rem` (24px) on small tablet viewports. Column gutter is set to `1rem` (16px) to give product pairs ample visual breathing space.
- **Horizontal Product Carousels:** Utilize negative margin bleed (`margin-sm` breakout) allowing product cards to peek past the edge by `20%`, visually communicating continuous swipeability.
- **Vertical Spacing Cadence:** Modules adhere strictly to an 8px modular spacing rhythm (using `space-xs` through `space-xl`).
- **Touch-First Reachability:** Key actions (AddToCart, Sticky Checkouts, Filter triggers) remain pinned within bottom action drawers with fixed bottom safe-area insets (`env(safe-area-inset-bottom) + space-md`).

## Elevation & Depth

Visual depth mirrors the soft, rich density of chocolate tiers resting on linen and fine paper. Rather than cold gray drop-shadows, this design system uses warm, cocoa-tinted ambient glows.

### Shadow Atmosphere
- **Ambient Chocolate Tint:** Shadows utilize deep brown color formulas (`rgba(38, 20, 13, 0.06)` to `rgba(38, 20, 13, 0.16)`) instead of synthetic neutral black. This warms up the cream surfaces and prevents dull, muddy borders.
- **Level 1 (Card & Shelf Elevation):** `0px 4px 16px -2px rgba(38, 20, 13, 0.06)`. Used for product display cards, collection tiles, and selector chips.
- **Level 2 (Floated Controls & Active Drag):** `0px 8px 24px -4px rgba(38, 20, 13, 0.10)`. Used for bottom navigation bars, sticky summary bars, and floating bag triggers.
- **Level 3 (Overlays & Dialogs):** `0px 16px 36px -6px rgba(38, 20, 13, 0.18)`. Applied to modal sheets, gift personalization drawers, and seasonal notification banners.

### Surface Tonal Hierarchy
- **Base Canvas:** `#FAF6F0` (velvety off-white foundation).
- **Secondary Containers:** `#F2E9DE` creates subtle inset definition for grouping without relying on heavy borders.
- **Borders & Dividers:** Kept faint and tactile using `1px solid rgba(78, 40, 22, 0.08)` to softly guide the eye without breaking immersion.

## Shapes

The shape philosophy takes inspiration from hand-poured chocolate bars, smoothed ganache edges, and polished bonbon silhouettes.

### Radius Assignments
- **Base Radius (`rounded`, 8px):** Input field corners, operational tags, badge elements, and toast notifications.
- **Card & Surface Radius (`rounded-lg`, 16px):** Confectionery product cards, promotional collection banners, order summary boxes, and interactive quantity selectors.
- **Modal & Container Radius (`rounded-xl`, 24px):** Bottom action sheets, gift customizers, loyalty celebration dialogs, and primary image viewports.
- **Pill Shape (`9999px`):** CTA buttons, search pills, flavor tags, and quick-add floating action triggers.

## Components

### Buttons
- **Primary Button (Cacau Sovereign):** Background `#26140D`, typography `label-lg` in `#FAF6F0`, border-radius `9999px`. Minimum height of `52px` to ensure an expansive touch target. Pressed state darkens with inner ambient warmth.
- **Secondary Button (Dourado Ouro):** Background `#D4AF37`, typography `label-lg` in `#26140D`, border-radius `9999px`. Used for high-value actions (e.g., "Assinar Clube do Chocolate", "Resgatar Recompensa").
- **Ghost & Outline Button:** Transparent background, `1.5px` border in `#8C5338`, label in `#26140D`. Hover/active fills with `rgba(140, 83, 56, 0.08)`.

### Cards (Appetite-Appeal Focus)
- **Product Card (Bombons & Barras):** Surface `#FAF6F0` framed by a subtle `1px` border of `#F2E9DE` and Level 1 chocolate shadow. Image container features a soft `#F2E9DE` background with an inset roundedness of `16px` to highlight cocoa texture, shine, and fillings. Includes an integrated quick-add `+` pill button (`48px` tap target).
- **Campaign / Seasonal Card:** Deep gradient background from `#26140D` to `#4E2816`, text in `#FAF6F0`, with `Dourado Brilhante` badges. Used for Páscoa, Natal, and exclusive single-origin harvest drops.

### Chips & Filter Pills
- **Inactive:** Background `#F2E9DE`, text `#4E2816`, height `40px`, roundedness `9999px`.
- **Selected:** Background `#26140D`, text `#FAF6F0`, shadow Level 1.
- **Sensory Attribute Chips (e.g., "70% Cacau", "Sem Glúten", "Avelã"):** Border `1px solid #8C5338`, text `#8C5338`, weight `label-md`.

### Form Inputs & Selectors
- **Text Inputs:** Height `52px`, background `#FAF6F0`, border `1.5px solid rgba(78, 40, 22, 0.15)`, radius `8px`. Focused state transitions to `1.5px solid #26140D` with a subtle caramel glow.
- **Labels:** Positioned clearly above the input using `label-md` in `#4E2816` for maximum legibility.
- **Quantity Selector:** Stepper with distinct `+` and `-` circular buttons (`48px` minimum touch target each) enclosed in a pill shell of `#F2E9DE`.

### Checkboxes & Radio Controls
- Minimum hit target wrapper of `48px × 48px`.
- **Unchecked:** `20px` square or circle with `2px` border in `#8C5338`, filled with `#FAF6F0`.
- **Checked:** Filled with `#26140D` displaying an inner check or dot rendered in `#D4AF37`.

### Distinctive Domain Components
- **Cacau Loyalty Progress Ribbon:** Dynamic progress track filled with `#D4AF37` on `#F2E9DE` track, denoting tiers from "Grão Verde" to "Mestre Chocolatier".
- **Gift Personalization Box (Monte Sua Caixa):** Interactive grid selector allowing users to drag and drop single truffles into a 4, 8, or 16-slot confectionery box with real-time sensory flavor tags.
- **Flavor Intensity Gauge:** A visual 5-bean scale indicating percentage of cocoa and sweetness profile directly above the fold on the product page.