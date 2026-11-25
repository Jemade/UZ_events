# Accessibility and browser verification record

Date: 25 November 2026.

## Completed source checks and fixes

- Archive search, faculty/category/year selectors now have accessible names.
- Audit search input and icon-only search button now have accessible names.
- Confirmation dialogs now have an accessible name derived from their title.
- Photo inputs have individual labels and a visible focus outline on their enclosing control.
- The phone More sheet moves focus into its links, cycles Tab/Shift+Tab through its controls, closes on Escape or backdrop click, returns focus, and disables interaction with the obscured main panel. Resizing back to desktop clears the open state.
- Photo uploads disable replacement/removal during upload, prevent form submission while busy and keep the previous preview on failure.
- Muted text is darker: #566372 measures 6.13:1 on white, 5.58:1 on paper and 5.21:1 on the navy tint. The accent text token was also darkened from #a85a00 to #995000 because the former measured 4.33:1 on the navy tint. These are formula-based token checks, not a full rendered-page contrast audit.
- Existing reduced-motion styles, field labels, skip link, focus styles and calendar filter labels were inspected in source.

## Browser verification (25 November 2026, headless Chrome via the DevTools protocol)

**Phone layout (390×844, touch):** 17 of 17 checks passed.
- More sheet: opens; focus moves inside; Tab and Shift+Tab stay inside it; the main panel is inert while it is open; Escape and backdrop clicks close it and return focus to More; a link inside it navigates and closes it.
- Real photo upload through the file picker: a 3000×2000 JPEG was shrunk in the browser to 1600×1067 (54 KB), saved, previewed, shown on the home page and removed again. A fake ".jpg" was refused with a message.
- **Bug found and fixed:** every browser upload used to fail. The resize step loaded the file from a `blob:` address, which the Content-Security-Policy blocks. It now uses `createImageBitmap`, which also follows phone-camera rotation and gives transparent PNGs a white background. The server-side tests could not catch this.

**Automated sweep:** 24 routes (public, display and every workspace page, signed in with the right role) at 360px and 1280px. Checked: unnamed controls, unlabelled fields, images without alt text, duplicate ids, a single h1 and no skipped heading levels, page language and title, horizontal overflow, and WCAG AA text contrast from computed colours.
- Before: heading levels skipped on most pages; no h1 on the display screen and "Page not found"; out-of-month calendar days at 1.77:1 contrast; unlabelled search on Published events; the page scrolled sideways on phones when signed in (header 32px too wide, search button cut off); the hero stamp covered the photo caption on phones.
- After: all fixed. The only remaining flag is the screen-reader-only h1 on the display screen, which is hidden on purpose.

**Keyboard walkthrough (1280px):** Tab through home, calendar, event page, staff sign-in, submit form and review queue. "Skip to content" is the first stop everywhere and every stop has a visible focus ring. Date and time fields had no ring; fixed with `:focus-within`.

The custom sweep is not axe or Lighthouse, and no screen reader was used. No WCAG conformance claim is made.

## Still to do (needs people or devices)

- Real phones (two or three, portrait and landscape) and a venue TV at viewing distance.
- A screen reader pass (NVDA on Windows or TalkBack on Android) on the public pages, submit form and review queue.
- Zoom to 200% and 400% on desktop.
- User-acceptance testing with real staff (see LAUNCH-AND-HANDOVER.md).
