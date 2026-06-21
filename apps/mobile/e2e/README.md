# Reader e2e safety net (Maestro)

Phase 0 regression net for the reader redesign. These flows lock in the
current reader's behavior so the redesign can be checked against a known-good
baseline. They assert that UI appears, not that AI content returns (the AI
sheets are Plus gated and may show a loading or upgrade state; that still
proves the sheet mounted).

These tests are not run in CI yet and need a booted emulator or simulator.

## What is covered

| Flow | Check |
| --- | --- |
| `flows/01-open-and-render.yaml` | Deep link into a book, confirm the reader shell paints (no error state) |
| `flows/02-paging.yaml` | Tap forward three pages, back three pages, reader survives |
| `flows/03-tool-sheets.yaml` | Companion hub (This Chapter grid, Story So Far, Characters, Search) + overflow (Listen, Sleep Timer, Vocabulary, Quote Card, Share) |
| `flows/04-text-selection.yaml` | Word tap to Look up; long press to Analyze |
| `flows/05-typography.yaml` | Open the Aa typography sheet |
| `flows/06-go-to.yaml` | Open the Go To sheet by tapping the title (TOC / Location / My Places) |
| `flows/07-close.yaml` | Back out of the reader |

`common/open-reader.yaml` is a shared subflow that launches the app and deep
links to the reader.

## Preconditions

1. Install Maestro: https://maestro.mobile.dev/getting-started/installing-maestro
2. Build and install a dev/preview build of the app on a booted emulator or
   simulator (`pnpm --filter mobile ios` or `android`, or an EAS build).
3. Sign in once, manually, on that device. The flows do not log in; the reader
   renders for an authenticated session, and a signed-out deep link can bounce
   to the auth stack. State is preserved between flows (`clearState` is not set).
4. Pick a real catalog book id with a resolvable epub. Pass it as `BOOK_ID`.

## Run

From `apps/mobile`:

```
# whole suite, ordered
maestro test -e BOOK_ID=<real-book-uuid> e2e

# a single flow
maestro test -e BOOK_ID=<real-book-uuid> e2e/flows/01-open-and-render.yaml

# interactive selector explorer (handy for fixing the notes below)
maestro studio
```

Screenshots land in the Maestro output directory per `takeScreenshot` name.

## How the flows reach the reader

Deep link via the `foxing` scheme: `foxing://reader/<BOOK_ID>`. Expo Router maps
that to `app/reader/[id].tsx`. Chrome has a single toggle in Phase 1: a center
tap. `common/reveal-chrome.yaml` taps center and re-taps only if chrome did not
appear, so it lands chrome-on from either starting state. Chrome auto-hides 3s
after it shows, so flows re-run that reveal before each bottom-bar interaction.

## Selector notes (confirm on first run)

Triggers use the reader's real accessibility labels and visible text, read from
source. A few dismiss/anchor selectors are best-effort and may need a tweak the
first time you run on a device:

- `05-typography` and `06-go-to` dismiss with the platform `back` gesture
  because those sheets expose no dedicated close label. On iOS, replace `back`
  with a tap on the sheet's done/close control once confirmed in `maestro studio`.
- `04-text-selection` taps fixed coordinates in the body text band
  (`30%, 45%` and `30%, 55%`). If a tap lands on whitespace the pill will not
  appear; adjust the point for your test book. This is the flakiest flow because
  selection happens inside the foliate WebView.
- `03-tool-sheets` asserts the generic `Close` label for the Search,
  ChapterFeature, and Characters sheets. Only one sheet is open at a time, so
  the match is unambiguous, but if a sheet's close copy changes, update it here.

## Entry-point map

The full trigger to sheet map this suite is built from lives in the Phase 0
report and in `app/reader/[id].tsx`. Keep this suite in sync when the reader's
entry points change.
