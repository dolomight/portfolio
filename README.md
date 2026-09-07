# Portfolio case-study framework

A dependency-free HTML/CSS/JS kit for long-form case studies, modeled on the
structure, sequence and motion of fantasy.co's work pages (e.g. LIV Golf).

```
site/
├── framework/
│   ├── case-study.css      all layout, type and component styles
│   └── case-study.js       word-reveal, sticky gallery, video cover, count-up, nav
├── templates/
│   └── case-study-template.html   copy this to start a new case study
├── case-studies/
│   └── jobsohio/index.html        first case study
└── assets/
    └── jobsohio/                  images, posters, (optional) mp4s
```

## Start a new case study

1. Copy `templates/case-study-template.html` → `case-studies/<slug>/index.html`.
2. Create `assets/<slug>/` and drop in screenshots (PNG/JPG), a hero poster, and
   optionally MP4s. Relative paths in the template already assume this layout.
3. Find-and-replace `PROJECT` with the slug/name, fill in copy, delete sections
   you don't need. Every section is independent — reorder freely.
4. Open `index.html` in a browser (or run `python3 -m http.server` from `site/`).

## Page sequence (matches the LIV Golf reference)

| # | Block | Class / hook |
|---|-------|--------------|
| 1 | Full-screen hero video, title bottom-left, meta row | `.media-hero` + `.video-cover[data-video]` |
| 2 | One-sentence intro statement | `.intro` + `[data-split]` |
| 3 | Large rounded screenshot | `.media-article` (+ `.browser-frame`) |
| 4 | Overview (eyebrow left, headline + body right) | `.text-section` |
| 5 | Numbered objectives | `.objectives` |
| 6 | Big display title → sticky gallery | `.display` then `.gallery` |
| 7 | Text section(s), quote | `.text-section`, `.quote` |
| 8 | Full-bleed video/image band | `.media-band` |
| 9 | Impact + stats carousel | `.text-section` + `.stats` |
| 10 | Up next cards (optional), full-screen video footer | `.up-next`, `.site-footer--media` |

Sections are separated by `<div class="space-large"></div>` (160px at desktop,
scales with viewport). Use `.space-xs` for a tighter gap.

## Behaviours (opt-in via attributes)

| Hook | What it does |
|------|--------------|
| `data-split` | Splits text into words and reveals them one by one when scrolled into view. |
| `data-reveal` | Fades/slides a block in. Stagger with `style="--d:120ms"`. |
| `.gallery` | Pins `.gallery__sticky` full-screen; the caption nearest the viewport centre activates the media of the same index. Item and caption counts must match. |
| `data-video="vimeo"` + `data-vimeo-id` (+ `data-vimeo-hash`) | Injects a muted, looping Vimeo background player sized to cover the box. |
| `data-video="file"` + `data-src` | Same, with a local MP4. Poster `<img class="video-cover__poster">` shows until playback starts. |
| `data-count="58"` (+ `data-suffix`, `data-prefix`) | Number counts up when visible. |
| `data-hero-fade` (on `.media-hero__media` inside `.media-hero__pin`) | Hero media stays pinned at the top and fades out over the first screen of scrolling; the title scrolls away normally. |
| `data-scrollfade` | Opacity/lift tracks the element's position as it rises through the lower third of the viewport (objective rows). |
| `data-scrollscale` | Element grows from 87.5% to full size as its top travels from the bottom of the viewport to the top, ease-out (the large media frames). |
| `data-media-scroll` (on `.media-article.media-scroll`, with `.media-scroll__sticky` → `.media-scroll__frame`) | Frame grows into a centred, pinned position, then the tall screenshot scrolls inside it before the page continues. `data-scroll-speed` = page px per screenshot px (default 0.75). |
| `.page-end` (last child of `<main>`) + `.site-footer--media` | Curtain ending: when `.page-end` scrolls into view, `<main>` gets `.is-light` and transitions its background to white (`--cs-page-end`) with navy text tokens; the page then scrolls up off a full-screen footer video pinned beneath it. |
| `data-footer-veil` (optional `.site-footer__veil` in the footer) | Dark veil over the footer video that fades out as the footer is revealed, if you want a softer reveal. |
| `.text-accent` (on a `data-split` subhead) | Subhead shifts to `--cs-heading-accent` once it has revealed. |
| `.site-nav` + `.site-menu` | Transparent fixed header. Once scrolled (`.is-scrolled`) the inline links fade out and a frosted hamburger pill (`.site-nav__toggle`) takes their place; it opens the full-screen `.site-menu`. The nav turns navy (`.is-light`) while the white page end covers the top of the viewport. |

`window.CaseStudy.init(rootElement)` re-runs the behaviours for injected content.

## Gallery shot variants

- `.gallery__shot` — desktop screenshot in a browser frame (16:10), left side.
- `.gallery__shot--mobile` — single phone-shaped frame.
- `.gallery__shot--pair` — desktop frame plus a phone overlay
  (`.gallery__shot-secondary`) tucked inside its bottom-right corner; the phone
  fades in and slides up a beat after the desktop frame for a layered feel.

Desktop shots fill the viewport height (`100svh − 12rem`) and crop the tall
page screenshot from the top.

Each item also has a blurred, dimmed `.gallery__bg` behind the shot — use the
same screenshot, a photo, or a video poster.

## Type & scale

`1rem = 10px` at ≥1280px wide; below that everything scales with the viewport
(mobile uses a 430px design width). Classes: `.h1 .display .h2-c .h3-c .h3 .h4
.h5 .h6 .eyebrow .body-large .body-normal .text-light .text-dim`. Fonts are
Inter (sans) and Barlow Condensed (condensed uppercase) from Google Fonts;
swap via `--cs-font-sans` / `--cs-font-cond`.

Per-project colours: set `--cs-bg` (page background, default `#003057`),
`--cs-accent`, and `--cs-heading-accent` (revealed-subhead colour) in the
page's `<style>`.

## Videos

- Public Vimeo videos embed anywhere with `data-video="vimeo"`.
- Domain-restricted Vimeo videos (Vimeo shows "Sorry" off-domain) won't play on
  the portfolio — use `data-video="file"` with a local MP4 instead. The JobsOhio
  aerospace band is wired this way; drop the MP4 at
  `assets/jobsohio/aerospace-header.mp4` and it plays automatically.
- Keep MP4s short (10–25s), muted, ≤1080p, ~5–15 MB.

## Accessibility & motion

- `prefers-reduced-motion` disables all reveals and transitions.
- Decorative images use empty `alt`; background videos are `aria-hidden`.
- The sticky gallery degrades to a normal stacked layout without JS (all items
  hidden except the first is not applied until JS runs — first item is shown
  via `.is-active` set by the script; without JS, captions still read in order).
