# TreeChess UI Redesign Plan

## Design Direction

**Inspiration:** chess.com — clean, functional, board-focused.
**Mode:** Light mode only.
**Accent color:** Warm amber orange (`#E67E22` primary, `#D4740A` hover) on a white/light gray base.
**Typography:** Inter (clean sans-serif). Fallback: system sans-serif stack.
**Chess board:** Keep current board styling unchanged (react-chessboard defaults).

---

## Color Palette

All colors defined as CSS custom properties in `tailwind.css` for easy swapping.

| Token              | Value       | Usage                                      |
|--------------------|-------------|---------------------------------------------|
| `--primary`        | `#E67E22`   | Buttons, active nav, links, accents         |
| `--primary-hover`  | `#D4740A`   | Button hover, active states                 |
| `--primary-light`  | `#FDF2E6`   | Active nav background, light badges, subtle highlights |
| `--primary-dark`   | `#A85C12`   | Focused outlines, pressed states            |
| `--bg`             | `#F9FAFB`   | Page background                             |
| `--bg-card`        | `#FFFFFF`   | Card surfaces, panels                       |
| `--bg-sidebar`     | `#FFFFFF`   | Sidebar background                          |
| `--text`           | `#1F2937`   | Primary text                                |
| `--text-muted`     | `#6B7280`   | Secondary text, labels                      |
| `--text-light`     | `#9CA3AF`   | Placeholder, disabled text                  |
| `--border`         | `#E5E7EB`   | Default borders                             |
| `--border-dark`    | `#D1D5DB`   | Emphasized borders                          |
| `--success`        | `#16A34A`   | Success states                              |
| `--danger`         | `#DC2626`   | Destructive actions, errors                 |
| `--warning`        | `#F59E0B`   | Warnings                                    |
| `--info`           | `#3B82F6`   | Informational highlights                    |

---

## Typography

- **Font family:** `'Inter', system-ui, -apple-system, sans-serif`
- **Headings:** Semi-bold (600), tracking tight
- **Body:** Regular (400), 14–16px depending on context
- **Small/labels:** Medium (500), 12px, uppercase where appropriate
- **Monospace (FEN, PGN):** `'JetBrains Mono', 'Fira Code', monospace`

---

## Layout & Navigation

### Left Sidebar (kept, refined)

- **Width:** 220px (desktop), collapsible icon-only mode at 60px
- **Background:** White with a subtle right border
- **Logo:** "TreeChess" in Inter Bold, with a small orange tree icon or chess piece accent
- **Nav items:**
  - Icon + label, vertically stacked
  - Active state: orange left border (3px) + `--primary-light` background + orange text
  - Hover: light gray background
  - Items: Dashboard, Repertoires, Games
- **User section:** Bottom of sidebar — avatar circle (initials), username, logout icon
- **Mobile:** Sidebar collapses to a bottom tab bar (3 icons) instead of horizontal top bar

### Main Content Area

- `flex-1`, scrollable, `--bg` background
- Consistent padding: `p-6` on desktop, `p-4` on mobile
- Max content width: none (full width utilization for board + panels)

---

## Page-by-Page Redesign

### 1. Dashboard (Activity Feed Focus)

**Layout:** Single column, centered, max-width `960px`.

**Sections (top to bottom):**

1. **Header row**
   - "Welcome back, {username}" as a subtle greeting
   - Quick action buttons row: "New Repertoire", "Import Games" — orange primary buttons

2. **Activity feed**
   - Chronological list of recent events:
     - Games imported (with result icon: win/loss/draw)
     - Repertoire edits (e.g., "Added 3 moves to Sicilian Defense")
     - Video imports completed
   - Each item: icon + description + timestamp + link to resource
   - Card-based items with white background, light border, subtle shadow on hover

3. **Repertoire overview strip**
   - Horizontal scrollable row of repertoire cards (compact)
   - Each card: name, color indicator (white/black piece icon), move count, last edited
   - Click to enter editor
   - "+" card at the end to create new repertoire

4. **Recent games section**
   - Compact table/list: opponent, result, opening, date, source icon (lichess/chess.com/PGN)
   - Row click navigates to game analysis

### 2. Repertoires Page

**Layout:** Grid of repertoire cards.

**Card design:**
- White card, rounded-lg, subtle shadow
- Top: Color indicator bar (thin orange bar for white repertoires, dark bar for black)
- Title (repertoire name), subtitle (e.g., "12 lines, 48 moves")
- Last edited date
- Hover: slight lift shadow, orange border accent
- Actions: Edit (primary), Delete (ghost/danger on hover)

**Empty state:** Centered illustration placeholder + "Create your first repertoire" CTA.

### 3. Repertoire Editor (Main screen — board left, tree right)

**Layout:** Two-column, no max-width (fills available space).

| Left Column (board) | Right Column (panel) |
|----------------------|----------------------|
| Chess board (square, responsive) | Tabbed panel |
| Eval bar (vertical, left of board) | Tab 1: Tree view (SVG or list) |
| Current position info below board | Tab 2: Move list (text) |
| Move input / add move controls | Tab 3: Engine lines |

**Board section:**
- Board fills available height, maintains 1:1 aspect ratio
- Eval bar: thin vertical gradient bar (white to black) on the left side of the board
- Below board: current FEN (monospace, small), flip board button, orientation indicator
- Move input area: clean input with "Add Move" orange button

**Right panel (tabbed):**
- Tab bar at top: "Tree" | "Moves" | "Engine" — orange underline for active tab
- **Tree tab:**
  - Toggle button in top-right corner to switch between SVG tree and indented list view
  - SVG tree: current implementation with pan/zoom, but with updated node colors (orange for main line, gray for alternatives)
  - Indented list view: collapsible tree like a file explorer
    - Each node: move number + SAN (e.g., "1. e4"), indented for variations
    - Click to navigate board to that position
    - Expand/collapse with chevron icons
    - Current position highlighted with orange background
- **Moves tab:** Linear move history for current line, clickable
- **Engine tab:** Stockfish top lines with eval scores, depth indicator

**Action bar (top of right panel or floating):**
- Delete branch, extract branch, import study — icon buttons with tooltips

### 4. Game Analysis Page

**Layout:** Two-column (same structure as editor).

| Left (board) | Right (panel) |
|--------------|---------------|
| Chess board | Move list with annotations |
| Eval bar | Repertoire comparison highlights |
| Navigation controls below board | |

**Move list:**
- Moves shown inline (e.g., "1. e4 e5 2. Nf3 Nc6...")
- Color-coded: green = matched repertoire, orange = deviation, red = mistake/blunder
- Click any move to jump to position
- Current move highlighted

**Navigation controls:**
- `|<` `<` `>` `>|` buttons (start, prev, next, end)
- Keyboard shortcuts (arrow keys) — already implemented

**Repertoire comparison panel:**
- When a deviation from repertoire is detected, show inline: "Your repertoire suggests: Nf3" with a link to jump to that line

### 5. Games Page

**Layout:** Single column, max-width `1200px`.

**Filter bar:**
- Horizontal row of filter chips/buttons
- Time control: All | Bullet | Blitz | Rapid | Daily
- Source: All | Lichess | Chess.com | PGN
- Repertoire filter dropdown
- Active filter: orange fill, inactive: outlined/ghost

**Import section:**
- Collapsible panel at top: "Import Games"
- Tabs: Lichess username, Chess.com username, PGN file upload
- Orange "Import" button

**Games list:**
- Clean table with columns: Result, Opponent, Opening, Time Control, Source, Date
- Result shown as colored dot (green/red/gray) or W/L/D badge
- Row hover: light highlight, click to analyze
- Pagination or infinite scroll

### 6. Login / Onboarding

- Centered card on `--bg` background
- TreeChess logo prominently displayed
- Clean form inputs with orange focus border
- "Sign In" orange primary button
- Onboarding modal: step-by-step with orange progress indicator

---

## Component Design System

### Buttons

| Variant     | Style                                                  |
|-------------|--------------------------------------------------------|
| Primary     | Orange bg (`--primary`), white text, rounded-md        |
| Secondary   | White bg, orange border, orange text                   |
| Ghost       | Transparent bg, gray text, hover: light gray bg        |
| Danger      | Red bg, white text (for destructive actions)           |
| Icon button | Ghost style with icon only, rounded-full, tooltip      |

All buttons: `font-medium`, consistent padding (`px-4 py-2` default), `transition-colors duration-150`.

### Cards

- White background, `rounded-lg`, `border` (`--border`)
- `shadow-sm` default, `shadow-md` on hover (with transition)
- Consistent padding: `p-4` or `p-6`

### Inputs

- White background, `rounded-md`, `border` (`--border`)
- Focus: orange ring (`ring-2 ring-primary/30`) + orange border
- Placeholder text: `--text-light`

### Modals

- Centered overlay with semi-transparent dark backdrop
- White card, `rounded-xl`, `shadow-xl`
- Header with title + close button
- Footer with action buttons (primary right-aligned)
- Smooth fade-in animation

### Toasts

- Bottom-right positioned
- Rounded, shadow, icon + message
- Color-coded left border (success=green, error=red, info=blue, warning=orange)
- Auto-dismiss with progress bar

### Tabs

- Underline style: orange bottom border for active tab
- Text: `--text-muted` for inactive, `--primary` for active
- No background change, clean and minimal

---

## Repertoire Tree — Dual View

### SVG Tree View (existing, updated)

- Node colors updated:
  - Main line nodes: orange fill
  - Alternative/variation nodes: light gray fill with orange border
  - Current position: bold orange ring
  - Transposition indicator: dashed purple (keep existing)
- Edge lines: gray, slightly rounded
- Background: subtle dot grid pattern (optional)
- Pan/zoom controls: minimal floating buttons in corner

### Indented List View (new)

- File-explorer style with collapsible sections
- Structure:
  ```
  ▼ 1. e4
    ▼ 1... e5
      ▼ 2. Nf3
        2... Nc6 (Main line)
        ▶ 2... d6 (Philidor)
    ▶ 1... c5 (Sicilian)
    ▶ 1... e6 (French)
  ```
- Chevron icons for expand/collapse
- Click a move to navigate the board
- Current position: orange background highlight
- Right-click context menu: delete, extract, set as main line
- Depth indicators: subtle vertical lines connecting children

### Toggle Switch

- Small icon toggle in the top-right of the tree panel
- Tree icon (graph) | List icon (lines)
- Persisted in localStorage

---

## Animations & Transitions

- **Page transitions:** Subtle fade-in for route changes (`opacity 0 -> 1`, 150ms)
- **Cards:** Hover lift with shadow transition (200ms ease)
- **Sidebar:** Collapse/expand with width transition (200ms)
- **Modals:** Fade in backdrop + scale up card (150ms)
- **Toasts:** Slide in from right (200ms)
- **Tree nodes:** Subtle scale on hover (50ms)
- **Tab underline:** Slide transition (150ms)

Keep animations minimal and fast. No flashy effects.

---

## Responsive Breakpoints

| Breakpoint | Layout changes                                           |
|------------|----------------------------------------------------------|
| `>= 1280px` (xl) | Full layout: sidebar (220px) + two-column content |
| `1024–1279px` (lg) | Sidebar collapses to icon-only (60px)           |
| `768–1023px` (md) | Single column content, sidebar as bottom tabs     |
| `< 768px` (sm) | Bottom tab bar, stacked panels, full-width board   |

---

## Implementation Phases

### Phase 1: Foundation
- [ ] Install Inter font (Google Fonts or self-hosted)
- [ ] Update `tailwind.css` with new color palette and theme tokens
- [ ] Create/update the `Button` component variants with new styles
- [ ] Update `Modal`, `Loading`, `Toast`, `EmptyState` components
- [ ] Update input/form element styles globally

### Phase 2: Layout & Navigation
- [ ] Redesign `MainLayout.tsx` sidebar with new styles
- [ ] Add sidebar collapse functionality (icon-only mode)
- [ ] Implement mobile bottom tab bar
- [ ] Update page container padding and max-widths

### Phase 3: Dashboard
- [ ] Redesign Dashboard with activity feed layout
- [ ] Create activity feed component with event items
- [ ] Add horizontal scrollable repertoire strip
- [ ] Redesign recent games section as compact list
- [ ] Update quick action buttons

### Phase 4: Repertoire Editor
- [ ] Redesign the two-column editor layout
- [ ] Implement tabbed right panel (Tree / Moves / Engine)
- [ ] Build the indented list tree view component
- [ ] Add tree/list toggle with localStorage persistence
- [ ] Update SVG tree node colors to match orange theme
- [ ] Redesign action bar with icon buttons + tooltips
- [ ] Polish board section (eval bar, controls below board)

### Phase 5: Games & Analysis
- [ ] Redesign Games page with filter chips and clean table
- [ ] Update import panel styling
- [ ] Redesign Game Analysis page move list with color-coded moves
- [ ] Update navigation controls styling
- [ ] Add repertoire comparison inline highlights

### Phase 6: Polish & Details
- [ ] Add page transition animations
- [ ] Refine hover states, focus states, and micro-interactions
- [ ] Accessibility pass: focus rings, ARIA labels, keyboard nav
- [ ] Responsive testing and fixes across all breakpoints
- [ ] Login/onboarding page refresh
- [ ] Final consistency review across all pages

---

## Notes

- **Board styling untouched:** react-chessboard keeps its current square colors. Can be revisited later.
- **Color swappability:** All colors go through CSS custom properties — changing the theme later means editing ~10 values in `tailwind.css`.
- **No component library added:** Stays custom-built with Tailwind. Adding a library (e.g., Radix UI primitives for accessibility) can be considered per-component if needed.
- **Backend unchanged:** This is a frontend-only redesign. No API changes required.
