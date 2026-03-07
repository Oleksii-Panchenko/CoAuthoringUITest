# Project Memory

## Key findings

### Word Online (Office Online) editor — clearText optimization
- `#WACViewPanel_EditingElement` is scoped to the **current section** only (not full document), confirmed by textContent returning ~88 chars for a section edit.
- `Home`+`Shift+End`+`Delete` is **broken**: clears only the last visual line; first visual line survives.
- `Ctrl+A`+`Delete` is **broken**: `Ctrl+A` selects the entire document (not section), causing a 60s timeout on large files (20MB+).
- Working pattern: `clickParagraphInSection` → `this.editor.focus()` → loop `this.page.keyboard.press('Backspace')` × text.length. Uses `page.keyboard` (not `element.press`) to avoid redundant per-iteration focus CDP calls. Halves CDP round-trips from 2N to N+1.
