# TutorHub Design System & Style Guide (Sprint 2 Light Mode)

**Source of Truth:** `client/src/index.css` (`:root` custom properties) & `client/index.html` (`Plus Jakarta Sans`)  
**Status:** Active for Sprint 2 (`BRV-04`). Dark Mode and Rating Stars / Trust Row / Tutor Review Stats are intentionally deferred to Sprint 3 (`F-17`–`F-19`).

---

## 1. Color Palette (60-30-10 Rule)

All colors live in `:root` in `client/src/index.css`. **Never write raw hex or `rgba(...)` values in `.tsx` components or below `:root`.**

| Role | Token | Value | Usage & WCAG AA Contrast Notes |
|---|---|---|---|
| **60% Dominant (Warm Cream)** | `--th-cream` (`--th-bg`) | `#F7F4EA` | Page canvas, input backgrounds, nested slot cards |
| | `--th-cream-subtle` (`--th-surface`) | `#EFEADC` | Table header strips, inactive tab bars, muted container fills |
| | `--th-cream-raised` (`--th-raised`) | `#FDFBF5` | Elevated cards, modals, navbar, filter containers, auth card |
| **30% Secondary (Blue)** | `--th-blue` | `#5476C4` | Active tab underlines, selected borders, focus outlines, brand dot, icons |
| | `--th-blue-button` | `#4162B2` | Primary button fill (`>= 5.3:1` WCAG AA with `#F7F4EA` text); hover `--th-blue-button-hover` (`#34519A`), active `--th-blue-button-active` (`#294282`) |
| | `--th-blue-text` | `#3554A1` | Links, prices/rates, active nav text, tag text (`>= 6.4:1` on cream/raised) |
| | `--th-blue-tint` / `--th-blue-tint-strong` | `rgba(84,118,196, 0.12 / 0.22)` | Chips, open `TimeTrack` segments, hover surfaces, info banners |
| **10% Accent (Deep Navy)** | `--th-navy` (`--th-ink`) | `#00072D` | Headings, body copy (`17.6:1` on cream), dark CTAs, avatars, wordmark |
| | `--th-ink-muted` | `rgba(0,7,45, 0.64)` | Secondary labels, captions, table headers (`~6.4:1` on cream) |
| | `--th-border` / `--th-border-strong` | `rgba(0,7,45, 0.11 / 0.22)` | Card edges, input borders, dividers |
| **Semantic (Desaturated)** | `--th-success` / `--th-success-bg` | `#245B43` / `#E2EFE8` | Confirmed bookings, verified email, success banners (`>= 6:1`) |
| | `--th-warning` / `--th-warning-bg` | `#7D5314` / `#F6EAD4` | Partial refunds (`REFUNDED_PARTIAL`), pending states (`>= 5.5:1`) |
| | `--th-danger` / `--th-danger-bg` | `#943232` / `#F6E2E2` | Cancelled bookings, destructive actions, validation errors (`>= 5.5:1`) |

---

## 2. Typography, Radius, Spacing & Elevation Tokens

- **Font Family:** `'Plus Jakarta Sans', 'Inter', system-ui, sans-serif` (`--th-font-display` & `--th-font-body`).
- **Type Scale:** `--th-text-display`, `--th-text-h1`, `--th-text-h2`, `--th-text-h3`, `--th-text-body` (`0.90625rem` / ~14.5px), `--th-text-caption` (`0.8125rem`), `--th-text-button` (`0.84375rem`). Use `.th-accent-text` on a `<span>` inside an `<h1>`/`<h2>` for a two-tone navy + blue headline.
- **Radius Scale:** `--th-radius-sm` (`8px`), `--th-radius-md` (`10px` — inputs, buttons, nested cards), `--th-radius-lg` (`16px` — main cards, modals, panels, tables), `--th-radius-pill` (`999px` — filter pills, status badges, small buttons).
- **Spacing Scale:** `--th-space-1` (`4px`), `--th-space-2` (`8px`), `--th-space-3` (`12px`), `--th-space-4` (`16px`), `--th-space-5` (`24px`), `--th-space-6` (`32px`), `--th-space-7` (`48px`).
- **Shadows:** Prefer crisp `--th-border` borders on cream + subtle navy elevation (`--th-shadow-sm`, `--th-shadow-md`, `--th-shadow-lg`).

---

## 3. Shared Component Classes

| Pattern | Classes | Notes |
|---|---|---|
| **Page Shell** | `.th-page`, `.th-page-header` | Max width `1120px`, generous top/bottom whitespace |
| **Cards & Panels** | `.th-surface`, `.th-panel` | `20px` radius, `--th-raised` fill, soft border + `--th-shadow-sm` |
| **Buttons** | `.btn.btn-ink` (or `.btn-primary`), `.btn.btn-navy` (or `.btn-dark`), `.btn.btn-outline-ink` (`.btn-secondary`), `.btn.btn-accent`, `.btn.btn-ghost`, `.btn.btn-danger-soft`, `.btn-link-ink` | All tappable controls inherit `min-height: 2.75rem` (44px WCAG touch target) |
| **Filter Chips & Radios** | `.th-pill`, `.th-pill[aria-pressed='true']`, `.th-pill-radio`, `.th-pill-check` | Pill radius; selected state switches to blue fill |
| **Status Pills** | `.th-tag` (blue tint), `.th-tag-primary` (completed), `.th-tag-success` (confirmed), `.th-tag-warning` (partial refund / pending), `.th-tag-danger` (cancelled), `.th-tag-navy` (dark badge) | Used by `BookingStatusTags` in `PriceSnapshot.tsx` |
| **Notices / Alerts** | `.th-notice`, `.th-notice-info`, `.th-notice-success`, `.th-notice-warning`, `.th-notice-error` | Always include `role="alert"` (errors) or `role="status"` (confirmations) |
| **Data Tables & Stats** | `.th-table-wrap` + `table.table.th-table`, `.th-stats` + `.th-stats-accent` | Rounded `20px` container, tabular numbers via `.th-num` |
| **Modals & Empty States** | `<Modal>` (`.th-modal`), `.th-detail` (`<dl>`), `.th-empty` | Keep existing `Modal` component so focus trap & `Escape` behavior stay intact |
| **Password Inputs** | `<PasswordInput>` (`.th-password-field`, `.th-password-toggle`) | Reusable eye-icon visibility toggle with `aria-label` & `aria-pressed` |
| **Brand & Illustrations** | `<BrandMark>`, `<AuthHeroGraphic>`, `<DiscoveryBannerArt>`, `<EmptyStateArt>` (`Illustrations.tsx`) | Token-driven inline SVG artwork (`aria-hidden="true"`, zero external URLs) |

---

## 4. Do / Don't Rules for Sprint 2 & Sprint 3 Screens

- **Do** reuse `.th-page`, `.th-page-header`, `.th-panel`, `.th-surface`, `<Modal>`, and existing button/tag classes for every new screen:
  - **Issue #3 (Cancel & Refund Modal, `F-10`–`F-12`):** Use `.btn-danger-soft` for the Cancel action, `.th-receipt` or `.th-notice-warning` for the 3-tier refund preview, and `.th-window-chip` for availability Edit/Remove controls.
  - **Issue #4 (Time Filter & Admin Views, `F-09`, `F-13`):** Add time dropdowns inside `.th-filter-fields` (auto-fit grid already scales cleanly); build `AdminTutorsView` and `AdminSubjectsView` with `.th-table-wrap` / `.th-panel` and `.th-tag-warning` for pending tutors.
  - **Issue #6 (Lesson Completion, `F-16`):** Use `<Modal>` + `.btn-ink` for "Complete lesson", `.th-tag-primary` for `COMPLETED`, and `.th-panel` / `.th-detail` to display `lessonSummary`.
- **Don't** add inline `style={{ color: '#...' }}` or raw hex values in `.tsx` files.
- **Don't** remove `html { scroll-padding-top: 4.75rem; }` in `client/src/index.css` (guarded by `client/src/stickyNav.test.ts`).
- **Don't** implement Dark Mode or Rating Stars yet — those belong to **Sprint 3** (`[data-theme="dark"]` token overrides in `index.css` + rating/review components for `F-17` / `F-18`).
