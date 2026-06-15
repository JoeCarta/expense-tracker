# Expense Tracker

A small personal expense tracker built as a single-page web app with **plain HTML, CSS, and JavaScript** — no frameworks, no build tools. Built for CSCI 39548 Assignment 2.

## Features

- **Add expenses** with description, amount, category, and date (defaults to today).
- **Validation** — rejects empty descriptions, non-positive amounts, and missing dates with an inline error message.
- **Delete** any expense; the list re-renders automatically.
- **Running totals**, recomputed on every change:
  - Overall total
  - Per-category totals
  - Count of expenses currently shown
- **Filter** by category (with an "All" reset). Totals reflect the filtered view.
- **Sort** by date or amount, ascending or descending.
- **Empty state** message when there are no expenses (or the filter matches none).
- **Persistence** via `localStorage` — your data survives a page refresh, and corrupt/missing data falls back to an empty list without crashing.
- **Currency conversion** — a "Convert to EUR" button calls a live exchange-rate API with `fetch` + `async/await`, shows a loading state, and handles errors gracefully.

## Running it

No install, no build step. Just open `index.html` in any modern browser:

```
open index.html      # macOS
start index.html     # Windows
```

Or double-click the file.

## Project structure

| File          | Responsibility                                          |
|---------------|---------------------------------------------------------|
| `index.html`  | Markup and structure                                    |
| `styles.css`  | Styling and responsive layout                           |
| `script.js`   | State, rendering, events, persistence, async fetch      |

## How it works

State lives in a single JavaScript array of expense objects. The DOM is rebuilt from
that array by a single `render()` function that runs after every state change — there
is no ad-hoc DOM mutation. Array methods (`map`, `filter`, `reduce`, `sort`) drive the
filtering, sorting, and totals.

## Exchange-rate API

Uses [open.er-api.com](https://open.er-api.com/v6/latest/USD), a free, no-key endpoint
that returns a `rates` object. No API key required.
