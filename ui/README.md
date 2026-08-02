# ALFRET UI — Scriptorium v0.1

Complete HTML/CSS interface for the ALFRET document management and analysis system.

## Structure

### Shell (`shell.html`)
Main application container with:
- Fixed sidebar navigation
- Header with status indicators
- Hash-based router
- Footer action bar
- Ambient aether background effects
- Tailwind theme configuration

### Views (`views/`)

#### `document-editor.html`
Three-panel manuscript editor featuring:
- **Left toolbar**: Version history, story map, bookmarks, annotations
- **Center workspace**: 
  - Sticky formatting toolbar (Rewrite, indent, formatting tools, tone shift, insert)
  - Parchment-textured document canvas
  - Live word count and autosave ticker
- **Right evidence rail** (XL breakpoint):
  - Critical evidence tier
  - Supporting data tier
  - Sentiment analysis (Formal/Evidential/Arcane)
- Scroll parallax effect on parchment
- Sentiment scoring via keyword analysis

#### `session-setup.html`
Configuration interface (2-column layout):
- **Left column**:
  - Project identity (name, tag, objective)
  - Repository source linking
  - Context window configuration (tokens, temperature, format)
  - Context inclusion toggles (commit history, issues, README, PR diffs)
- **Right column**:
  - Model selection cards (Claude Sonnet 4.5, Opus 4, Gemini, GPT-4o)
  - Session summary live preview
  - Token budget visualization

#### `model-analysis.html`
Dashboard for telemetry and performance:
- **KPI cards** (Total Requests, Avg Latency, Tokens Used, Success Rate)
- **Token distribution** bar chart
- **Model benchmark** comparison table
- **Live event log** (REQUEST/RESPONSE/ERROR/CACHE events)
- Real-time statistics animation

#### `scriptorium-hub.html`
Archive library browser:
- Volume/collection cards
- Metadata display
- Create new volume CTA

#### `refinery.html`
Document processing queue:
- Processing status cards
- Progress indicators
- Action buttons (Save, Seal Refinement)

#### `repository-inventory.html`
Repository catalog:
- Repository metadata table
- Sync and add controls
- Status indicators

## Navigation

Navigation is hash-based (`#view-name`). The shell's router automatically:
1. Fetches the corresponding view HTML from `views/{view-name}.html`
2. Injects it into `#view-root`
3. Updates active nav state
4. Swaps footer actions from the view's template

## Design System

### Colors (Crimson + Gold theme)
- **Primary**: `#ffb4ab` (warm crimson)
- **Secondary**: `#ffb4ac` (complementary crimson)
- **Tertiary**: `#e9c176` (warm gold, success states)
- **Surface stack**: `#0d0e0f` to `#333535` (darkest to lightest)

### Typography
- **Room Heading**: Cormorant SC (display titles)
- **Document Heading**: Cormorant Garamond (article titles)
- **Body**: Source Serif 4 (flowing text)
- **UI Label**: Inter (buttons, labels)
- **Technical Data**: IBM Plex Mono (monospace, metadata)

### Components
- Parchment texture (document-editor only)
- Evidence rail (3-tier structure)
- Token budget bars (animated)
- Model selection cards (radio-toggle style)
- Live event log (timestamp + type + message)

## Interactivity

### Document Editor
- Contenteditable sections (title, subtitle, body)
- Real-time word count
- Autosave ticker (HH:MM:SS)
- Sentiment analysis from keyword scoring
- Scroll parallax (parchment rotates/translates)

### Session Setup
- Temperature slider sync
- Model card toggle
- Token budget mapping
- Summary preview live-update
- Repo fetch button (stub)
- Launch session animation

### Model Analysis
- KPI count-up animation
- Token bar animation
- Live log event injection (8 initial + periodic)
- Clear log button

## Footer Actions

Each view defines its own footer actions in a `<template id="footer-actions-{view-name}">` block, injected on mount. Examples:
- Document Editor: Export PDF, Markdown, Publish to Repo
- Session Setup: Reset Defaults, Launch Session
- Model Analysis: Export Report, Refresh Telemetry

## CSS Tailwind Config

All colors/fonts are Tailwind-extended via `tailwind.config` in `<script>`. No external CSS files needed.

## Usage

### Serve
```bash
npx http-server ui/ -p 8000
```

### Load in App
```javascript
// Shell loads first
// On hash change: fetch views/{name}.html → inject into #view-root
// View's footer template auto-injects into #footer-actions
```

### Modify a View
1. Edit `views/{view-name}.html`
2. Keep `<template id="footer-actions-{view-name}">` at the bottom
3. Keep `<script>` block for interactivity
4. Shell will auto-mount on hash navigation

---

**Version**: 0.1 (Baustein 5)  
**Status**: Feature-complete shell + 5 views  
**Next**: Backend integration, API wiring, data persistence
