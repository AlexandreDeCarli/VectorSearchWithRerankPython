---
name: VectorScoreRanking
description: A clean, data-dense semantic search interface serving MySQL 9.0 vector retrieval.
colors:
  primary: "#8b5cf6"
  accent-indigo: "#6366f1"
  accent-purple: "#a855f7"
  accent-blue: "#3b82f6"
  accent-cyan: "#06b6d4"
  neutral-bg: "#0a0b10"
  neutral-surface: "#12131a"
  text-primary: "#f8fafc"
  text-secondary: "#94a3b8"
  text-muted: "#64748b"
  success: "#10b981"
  danger: "#ef4444"
  warning: "#f59e0b"
typography:
  display:
    fontFamily: "Outfit, sans-serif"
    fontSize: "2.2rem"
    fontWeight: 700
    lineHeight: "1.2"
  headline:
    fontFamily: "Outfit, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: "1.3"
  title:
    fontFamily: "Outfit, sans-serif"
    fontSize: "1.1rem"
    fontWeight: 600
    lineHeight: "1.4"
  body:
    fontFamily: "Outfit, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 400
    lineHeight: "1.5"
  label:
    fontFamily: "Outfit, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 500
    lineHeight: "1.0"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
spacing:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  xxl: "30px"
  xxxl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  button-secondary:
    backgroundColor: "rgba(255, 255, 255, 0.08)"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  input-field:
    backgroundColor: "rgba(255, 255, 255, 0.04)"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  card-container:
    backgroundColor: "rgba(18, 19, 26, 0.65)"
    rounded: "{rounded.xl}"
    padding: "40px"
---

# Design System: VectorScoreRanking

## 1. Overview

**Creative North Star: "The Semantic Terminal"**

"The Semantic Terminal" is a developer-focused, information-dense, and highly structured dashboard design. Designed specifically for inspecting vector similarity and managing embedding indices, it rejects decorative fluff in favor of raw database reality, technical utility, and visual structure. The experience should feel like walking into a well-lit server room: silent, hyper-organized, and fast.

This system explicitly rejects the overly playful, rounded-corners "startup" aesthetic. It also forbids gradient text headers, decorative glassmorphism, and arbitrary color usage. Contrast and visual density are tuned to highlight relevance scores and structure content cleanly.

**Key Characteristics:**
- **Information-Dense Grid Layouts**: Maximized screen utility with clean panel boundaries.
- **Precise Accent Anchoring**: Accents are reserved exclusively for interactive elements and state feedback.
- **Micro-elevation Responses**: Interfaces are flat and clean at rest, lifting only when hovered or active.

## 2. Colors

A Tech Density Dark palette utilizing deep dark-space grays for backgrounds, clean slate grays for type hierarchy, and precise neon-adjacent semantic accents for status and vectors.

### Primary
- **Tech Indigo** (#8b5cf6): Used as the primary interactive accent, focus rings, and selection indicators.

### Neutral
- **Deep Space Black** (#0a0b10): Canonical page background.
- **Terminal Surface** (#12131a): Background for cards, panels, and dialog components.
- **Pure White Ink** (#f8fafc): Primary body and heading text.
- **Muted Slate Ink** (#94a3b8): Secondary captions, label text, and borders.
- **Terminal Gray Ink** (#64748b): Muted timestamp details and placeholders.

### Named Rules
**The Rarity Rule.** Accents (indigo, cyan, violet) must occupy less than 10% of the screen real estate. Color is a high-contrast indicator of interactivity or similarity, not a background wash.
**The High-Contrast Input Rule.** Input values and active selections must meet a minimum 4.5:1 contrast against their dark background. Text should never be hard to read for the sake of "minimalism."

## 3. Typography

**Display Font:** Outfit (with fallback `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`)
**Body Font:** Outfit (with fallback `sans-serif`)
**Label/Mono Font:** Outfit / system monospace for raw vectors

**Character:** Modern geometric sans-serif with a crisp, high-tech structure. Wide letters look clean in uppercase label roles and highly legible at small body sizes.

### Hierarchy
- **Display** (Bold 700, 2.2rem (35px), 1.2): Main header titles. Used in logo sections and landing view frames.
- **Headline** (Bold 700, 1.5rem (24px), 1.3): Major page section headers.
- **Title** (Semi-Bold 600, 1.1rem (18px), 1.4): Card titles, panel headings, and modal sub-headers.
- **Body** (Regular 400, 0.95rem (15px), 1.5): Standard interface labels, document content text, and descriptions. Max line-length capped at 75ch.
- **Label** (Medium 500, 0.85rem (13.6px), 1.0): Uppercase action prompts, buttons, table headers, and tags.

### Named Rules
**The No-Caps Prose Rule.** All-caps formatting is strictly limited to short labels, eyebrows, and button prompts (under 4 words). Sentence-length body text must never be uppercase.

## 4. Elevation

The interface remains flat and layered by default. Hierarchy is established using distinct background values (Deep Space Black vs. Terminal Surface) rather than relying on shadow offsets.

### Named Rules
**The Flat-Rest Rule.** Interactive elements (cards, buttons) rest flat against the surface. Shadow offsets and border highlight transitions trigger exclusively as feedback to user hover or focus states.
**The Flat Border Rule.** All borders separating panels must be thin (1px) and dark (rgba(255, 255, 255, 0.08)), serving as clean visual boundaries rather than glowing lines.

## 5. Components

Components are styled with sharp radii, minimal padding bloat, and distinct state feedback.

### Buttons
- **Shape:** Rounded corners (8px radius).
- **Primary:** Violet/Indigo gradient background with white text. Padding (12px vertical, 24px horizontal).
- **Secondary:** Semi-transparent white background (rgba(255, 255, 255, 0.08)) with white text.
- **Hover / Focus:** Scale transitions of opacity (to 0.95) and scale-up transform transitions are forbidden. Transform transitions are limited to subtle Y-translation (translateY(-1px)) combined with shadow glow adjustments.

### Cards / Containers
- **Corner Style:** Rounded corners (16px radius).
- **Background:** Semi-transparent glassmorphic surface (rgba(18, 19, 26, 0.65)) with a background blur (16px).
- **Shadow Strategy:** 0px shadow at rest, elevating to a deep soft shadow (0 10px 25px -5px rgba(0,0,0,0.3)) only when hovered.
- **Border:** Subtle border stroke (1px solid rgba(255, 255, 255, 0.08)).

### Inputs / Fields
- **Style:** Flat dark background (rgba(255, 255, 255, 0.04)), 1px border stroke (rgba(255, 255, 255, 0.08)), rounded corners (8px).
- **Focus:** 1px border shift to Tech Indigo (#8b5cf6) with a subtle violet focus glow (rgba(139, 92, 246, 0.15)).

### Navigation
- **Style:** Floating top bar with blur backdrop-filter. Standard navigation links are white, transitioning opacity on hover.

## 6. Do's and Don'ts

### Do:
- **Do** maintain a strict 4.5:1 text contrast on all dashboard elements.
- **Do** preserve the Outift font stack across all components and platforms.
- **Do** use `text-wrap: balance` on H1 and H2 headers to prevent awkward line breaks.
- **Do** use transition speeds of exactly 0.3s with cubic-bezier(0.4, 0, 0.2, 1) for smooth micro-interactions.

### Don't:
- **Don't** use colored side-stripe borders (e.g. border-left: 4px) to denote page sections or alert blocks.
- **Don't** use gradient text on headers (e.g., background-clip: text combined with gradient backgrounds). Headings must remain solid white.
- **Don't** animate or transform the size or position of `<img>` elements during parent container hovers.
- **Don't** use uppercase eyebrows above every page section title. Use them only for sequence-driven labels.
- **Don't** add random backdrop blur glassmorphism as a default background decoration. Use solid or standard semi-transparent surfaces unless establishing overlay depth.
