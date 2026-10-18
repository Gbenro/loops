# Validation and review limits

## Completed

- The dependency-free build completed successfully with Node 24.19.0.
- `node --check dist/app.bundle.js` passed for the generated browser JavaScript.
- All **25 automated tests** passed. They cover synthetic provenance; text and voice validation; preservation of original text; pagination and context filtering; isolated snapshots; Loop transitions/history; explicit bidirectional Thread links; reflection authorship; selected-only scripted chat context; reset; robust hash parsing; all requested view templates and error states; deterministic eight-phase/time rendering; standalone asset embedding and network blocking; and exact application embedding in the desktop/mobile review file.
- The additional audio tests cover digital silence, response to known input, gentle settling, temporal placement of a known pulse, stereo energy preservation, playhead-to-envelope interpolation, nonconstant measured fixture data, waveform provenance, timestamped fallback gaps, node/animation cleanup, decode failures, and reduced-motion behavior. Native audio interfaces were stubbed for lifecycle tests; these are not device microphone tests.
- The narrated audio fixtures were decoded to derive 256 amplitude samples each. Embedded duration values come from decoded PCM; browser media metadata is authoritative during playback.
- Primary text-token contrast was calculated against both canvas and surface colors. The minimum sampled normal-text contrast is **4.56:1** for light-mode metadata on the canvas. This is a token check, not a certification of every rendered composition.
- The application contains embedded assets and no remote script, stylesheet, font, analytics, or service dependency. Its CSP blocks network connections. No credentials are included.

## Not verified here

The environment did not expose the supported browser-control skill for managed preview. No preview server was started, no browser screenshots were taken, and no end-to-end browser or microphone test was run. The source was **not** checked by a static TypeScript compiler; Node strips its types and validates executable syntax. A strict `tsconfig.json` is included for the receiving development environment.

The prototype should therefore be reviewed in a real browser before adopting its design or integrating it. Automated template tests do not establish that layouts, focus behavior, playback, recording, or browser permissions work in every target environment.

## Suggested browser acceptance pass

| Area | Check |
| --- | --- |
| Desktop/mobile | Open `Luna-Review.html`, switch viewport sizes, inspect long titles and empty states, and check for horizontal overflow. |
| Real mobile | Open the standalone app on the intended device; check safe-area spacing, keyboard overlap, touch controls, and browser media support. |
| Capture | Allow then deny microphone access, record speech and silence, observe settling, stop, preview, keep, cancel, retry, and reload. Confirm the live-data label and test a browser that cannot decode its recorded format. Confirm no server upload and that session clearing is understood. |
| Original Voice | Play both synthetic samples, inspect the measured waveform, pause and confirm that progress freezes, seek while playing and paused, and navigate away during playback. |
| User text | Create a long and a short Echo, include punctuation and markup-like text, then search and return to it. |
| Loops and Threads | Change all intention states, revisit source Echoes, and connect the same Echo to a Thread twice without duplication. |
| Chat | Select/remove context, send messages, switch views during the scripted response, and verify all source links. |
| Accessibility | Traverse using only the keyboard, use the skip link, close dialogs with Escape, inspect focus return, try 200% zoom, and verify screen-reader labels. |
| Visual settings | Inspect both themes, the eight-node phase orbit, all phase/time combinations, and reduced-motion preference. Confirm that reduced motion shows a still live curve and measured level. |
| Review states | Exercise loading, empty, error, permission-denied, offline, microphone-denied, and deliberate reset. |

No production readiness claim is made. No deployment or integration with the existing Luna application was performed.
