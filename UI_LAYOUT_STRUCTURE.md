# UI Layout Structure and Responsibilities

The screen uses a **3-pane responsive layout**.  
On large screens, panes appear side-by-side. On smaller screens, they stack vertically.

## Overall Structure

- **Shell (`RootLayout`)**
  - File: `src/app/layout.tsx`
  - Responsibility:
    - Defines global HTML/body wrapper.
    - Applies app-wide fonts and metadata.
    - Ensures full-height page behavior.

- **Main screen (`Home`)**
  - File: `src/app/page.tsx`
  - Responsibility:
    - Manages page-level state (story, loading, events, graph settings, diagnostics filters).
    - Coordinates API extraction flow and graph rendering logic.
    - Arranges the three visible panels.

## Left Panel: Input and Controls

- Location: first `<section>` in `src/app/page.tsx`
- Desktop width: fixed (`lg:w-[420px]`)
- Responsibility:
  - Shows app title and purpose text.
  - Accepts story input in a textarea.
  - Displays character count and request elapsed time.
  - Triggers extraction (`Extract Graph`) and cancellation (`Cancel`).
  - Hosts **GraphControls**:
    - Graph mode (Timeline / Character relations)
    - Sequence edge toggle
    - Character edge style selector
    - Pronoun resolver toggle
    - Debug toggle (non-production only)
  - Shows optional pronoun resolver preview area (debug mode).
  - Displays API and validation errors.
  - Displays large-graph warning and graph-block message.
  - Provides expandable raw events JSON output for inspection.

## Center Panel: Graph Canvas

- Location: second `<section>` in `src/app/page.tsx`
- Layout behavior: fills remaining width (`flex-1`)
- Responsibility:
  - Renders event graph using `ReactFlow`.
  - Shows interaction helpers:
    - `MiniMap`
    - `Controls`
    - `Background`
  - Applies render safety behavior:
    - If graph is too large (`blockGraphRender`), hides graph and shows fallback text.
  - Receives already transformed and laid-out nodes/edges from graph pipeline logic.

## Right Panel: Diagnostics

- Location: `<aside>` in `src/app/page.tsx`
- Desktop width: fixed (`lg:w-[420px]`)
- Responsibility:
  - Displays diagnostics heading/context.
  - Renders **GraphDiagnostics** component with:
    - Severity and category filters
    - Request and graph summary stats
    - Diagnostics observability metrics
    - Per-rule hit counts
    - Filtered diagnostics list (errors/warnings)
  - Helps inspect structural quality and issues in extracted graph data.

## Styling Responsibilities

- File: `src/app/globals.css`
- Responsibility:
  - Imports Tailwind.
  - Defines theme variables (background/foreground, fonts).
  - Applies global body colors and typography defaults.
  - Customizes ReactFlow controls and minimap visuals to match dark theme.

## Quick Component Hierarchy

`RootLayout -> Home -> (Left Input/Controls Section, Center Graph Section, Right Diagnostics Aside)`

