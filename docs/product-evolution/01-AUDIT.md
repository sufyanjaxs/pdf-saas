# 01 — Current Codebase Audit (Deliverables A, B, C, D)

> Research only. Every claim below was verified against the source at `D:\pdf-saas`
> (branch `main`, clean tree, HEAD `1e71c01`). Line numbers refer to current files.

---

## A. Current architecture

### Stack

| Layer | Technology | Version (locked) |
|---|---|---|
| Framework | Next.js (App Router, `output: 'export'`) | 14.2.35 |
| UI | React + Tailwind + lucide-react | 18.3.1 / 3.4.19 / 0.427.0 |
| PDF manipulation | `@cantoo/pdf-lib` (maintained fork of pdf-lib) | 2.8.3 |
| PDF rendering / text | `pdfjs-dist` (legacy build) | 3.11.174 |
| Office output | `docx` / `exceljs` / `pptxgenjs` | 9.7.1 / 4.4.0 / 4.0.1 |
| Office input | `mammoth` (.docx → text) | 1.12.1 |
| Build orchestration | Turbo + npm workspaces | 2.3.x |
| Tests | Vitest (node env only) | 2.1.9 |

Dead dependency: `pdf-lib@1.17.1` is declared in both `apps/web/package.json` and
`packages/pdf-engine/package.json` but **never imported** anywhere.

### Monorepo layout

```
apps/web            Next.js static-export site (basePath /pdf-saas)
  app/              layout.tsx, page.tsx, tools/[slug]/page.tsx, not-found.tsx
  components/tools/ 34 tool components + shared (ToolWorkspace, FileUploader,
                    ResultPanel, ResultPreview, ProcessingOverlay, PageGrid…)
  components/ui/    button, card, image-canvas, crop-overlay, before-after-slider…
  workers/          pdf.worker.ts (175 ln), image.worker.ts (403 ln)
  hooks/            useWorker (generic), usePdfWorker, useImageWorker, usePdfPages
  lib/              tools/{definitions,registry,icon-map}, pdfjs.ts, office.ts,
                    client-utils.ts
packages/shared     worker protocol types + ToolMeta (206 ln)
packages/file-utils validation, page ranges, base64, mime maps (183 ln)
packages/pdf-engine all PDF ops via @cantoo/pdf-lib (462 ln)
packages/image-engine canvas/OffscreenCanvas image ops (409 ln)
```

Packages are consumed as raw TS (`"main": "./src/index.ts"`) and transpiled by
Next (`transpilePackages`). No package-level tsconfigs exist; root
`tsconfig.base.json` is **orphaned** — nothing extends it.

### Processing pipeline

```
File input (browser)
  → validateFiles() [file-utils]
  → tool component state (useState per tool; no global store)
  → usePdfWorker / useImageWorker  (one Worker per hook instance, terminated on unmount)
      pdf.worker: dispatch table → pdf-engine functions (bytes in/out as Uint8Array)
      image.worker: dispatch table → image-engine or inline pixel loops
        (image payloads travel as BASE64 STRINGS; pdf payloads as Uint8Array)
  → ResultPanel/ResultPreview (blob URL + size stats + download link)
Office conversions run on the MAIN THREAD via lib/office.ts (docx/exceljs/pptxgenjs/mammoth),
with pdf.js for rendering/extraction.
```

### Tool registry

- `lib/tools/definitions.ts`: **34 tools** (14 PDF, 16 Image, 4 Office). README still says 23.
- `lib/tools/registry.tsx`: every tool is a `next/dynamic` lazy import with skeleton — good code splitting. First-load JS ≈ 103 kB.

### Deployment

`.github/workflows/deploy-pages.yml`: push to main → npm ci → npm run build →
upload `apps/web/out` → actions/deploy-pages. **No test/typecheck/lint gates.**
No CNAME; basePath `/pdf-saas` hardcoded in `next.config.js` and duplicated as a
literal string in `lib/pdfjs.ts:17` and `lib/office.ts:26`.

### Tests

Vitest includes only `packages/**/*.test.ts`, node environment:

- `pdf-engine`: solid happy-path coverage of all 14 ops (encrypt roundtrip included).
  NOT tested: strong/maximum compression paths (would have caught bug #1 below), WEBP rejection, encrypted-input errors.
- `file-utils`: formatBytes, parsePageRanges, validateFiles, mime maps — fine.
- `image-engine`: **largely illusory** — tests re-implement algorithms inside the test file instead of calling the real exports; real functions (resizeImage, compressImageAdvanced, cropImage…) have zero coverage.
- Zero tests for: both workers, all hooks, lib/pdfjs, lib/office, all 34 components. No E2E framework in repo (previous Playwright runs were ad-hoc, uncommitted).

---

## Verified critical findings

### 1. PDF compression Strong/Maximum is a silent no-op  🔴 worst finding
`packages/pdf-engine/src/index.ts:442-447`:

```ts
if (filter instanceof PDFName && filter.asString() === 'DCTDecode') isJpeg = true;
```

Verified against the installed fork: `PDFName.asString()` returns the encoded name
**including the slash** (`'/DCTDecode'`), so `isJpeg` is never true and no image is
ever recompressed. The array branch checks `Array.isArray(filter)` but pdf-lib arrays
are `PDFArray` instances, never JS arrays. Net effect: all three "levels" produce
identical object-stream re-saves, while `PdfCompressorTool.tsx:20-22` promises
"5–15% / 20–40% / 40–60% smaller", "reduces resolution", "removes metadata" — none
of which happen beyond structural cleanup.

### 2. Three shipped tools are broken at runtime
Worker op-name drift (nothing tests worker dispatch):
- `BackgroundRemoverTool.tsx:28` sends `'remove-background'`; no such case exists in `image.worker.ts` → falls into generic handler → throws. **No background-removal algorithm exists anywhere in the repo** (no model, no flood-fill). UI advertises transparent PNGs.
- `ImageTextTool.tsx:103` sends `'add-text'`; no handler → live canvas preview works, export always throws.
- `CircleImageTool.tsx:33` sends `'circle'` but worker registers `'circle-crop'`; opts also mismatch (`size/borderColor/borderWidth` vs payload's `bgColor/...`) so even renamed it would misbehave.

### 3. GIF conversion target throws
`ImageConverterTool.tsx` offers `image/gif` output; browsers cannot encode GIF via
`canvas.convertToBlob` → runtime error on that path.

### 4. Object-URL leaks (systemic)
Blob URLs created in render bodies without revoke (new leak every render):
`PdfResultView.tsx:28`, `CircleImageTool.tsx:125`, `BackgroundRemoverTool.tsx:59,125`,
`ImageSharpenTool.tsx:62`, `ImageBlurTool.tsx:62`, `ImageBrightnessTool.tsx:55`,
`ImageGrayscaleTool.tsx:51`, `ImageFlipTool.tsx:52`, `ImageRotateTool.tsx:59`,
`ImageCropperTool.tsx:216`, `JpgToPdfTool.tsx:101`, `ImageResizerTool.tsx:67,95`,
`ImageQualityAnalyzerTool.tsx:143`, `PassportPhotoTool.tsx:108,120`,
`OfficeConvertCard.tsx:60`. Correct examples exist (`image-canvas.tsx:32-39`).

### 5. Cancellation is cosmetic
`useWorker.cancel()` posts a signal the worker only checks *before starting* an op;
a running merge/compress runs to completion, and the pending promise is never
settled → `running` stays true → subsequent runs reject with "already running"
until the original finishes. UI can wedge.

### 6. Memory & performance risks
- Image payloads cross to workers as **base64 strings** (+33% size plus peak copies); PDFs use typed arrays. No transferables anywhere.
- `renderThumbnails` (`lib/pdfjs.ts:37-57`) renders **every page** of a PDF up front into dataURL strings — 500-page PDF = 500 canvases at once (merger/splitter/delete/organizer/extractor/pdf-to-jpg all use it).
- `compressPdf` balanced holds original + two full saves concurrently (~3× doc size).
- Custom resize accepts up to 10000×10000 inputs (`ToolWorkspace.tsx:172-173`) → ~400MB bitmaps silently.
- Merger keeps all thumbnails + re-reads all ArrayBuffers on run; no total-size cap.
- React anti-patterns: side-effectful `useState(() => …)` initializer (`BackgroundRemoverTool.tsx:152`), unconditional setState during render (`PdfOrganizerTool.tsx:42-44`), img.onload + arbitrary `setTimeout(50)` race (`PassportPhotoTool.tsx:94-95`).

### 7. Product-level capability gaps (from code)
- **Crop is reversible**: sets CropBox only; content fully recoverable. **No redaction tool exists.**
- **Text extraction fidelity is low**: `office.ts:46-69` concatenates `item.str` honoring only `hasEOL` — columns interleave, reading order wrong.
- **PDF→Excel has zero table detection**: one row per text line, three columns Page/Line/Text (`office.ts:124-147`).
- **PDF→Word loses layout/images/fonts**; bold "Page N" headers only.
- **PDF→PPT is full-page JPEG slides**; text unselectable.
- **Word→PDF hard-fails on non-WinAnsi characters** (CJK, emoji, curly quotes) because `textToPdf` embeds Helvetica only (`office.ts:178-187`, engine `textToPdf:295-345`).
- **Fonts**: Helvetica/HelveticaBold only everywhere; no embedding/subsetting/unicode.
- **Protect grants ALL permissions** (`pdf-engine:182-190`) — open-lock only, not a restrictions lock.
- **Watermark & page numbers ignore `/Rotate`** → misoriented stamps on rotated pages.
- **WEBP→PDF rejected** by engine (`pdf-engine:357`) although JpgToPdf accept list includes webp — chicken-and-egg inside the same app.
- Duplicated logic: `parseRanges` (engine:485) ≡ `parsePageRanges` (file-utils:64); `formatBytes` re-implemented in `ImageQualityAnalyzerTool.tsx:121`; `atobToBytes` duplicates `base64ToUint8`; dead code: worker `info`/`analyze` ops, shared `ToolResult` envelope, file-utils download helpers.

### 8. SEO weaknesses
- Per-tool metadata exists (title/description/keywords) but: **no canonical URLs, no OG/Twitter cards, no JSON-LD, no sitemap.ts, no robots.ts**, homepage is hero+grid+footer (thin), no FAQ/how-to content anywhere, README outdated (23 vs 34 tools).

### 9. Accessibility & UX inconsistencies
- Some good primitives: FileUploader has role/tabIndex/onKeyDown; PageGrid uses aria-pressed; zoom controls labeled.
- Gaps: `ImageTextTool.tsx:144` uses `<span role="button">` with no keyboard support; overlays lack focus management; no skip links; **no dark mode**; no PWA manifest; no i18n. Mobile behavior untested; drag handles use pointer events (good start) but touch target sizes are inconsistent.

### 10. Privacy posture — verified clean ✅
- No analytics/tracking scripts, no gtag/beacon/posthog/plausible anywhere.
- Only outbound call is a local `fetch(blobUrl)` in `ResultPreview.tsx:45`.
- Fonts self-hosted at build time via `next/font/google` (no runtime Google request).
- Static Pages hosting; no server endpoints exist. The claim "files never leave your device" is **technically accurate today** — but nothing guards it (see Testing plan: add a network regression test).
- One nit: `public/pdf.worker.min.js` (1.08MB generated artifact) is committed to git.

---

## B. Current product strengths

1. **Architecture bones are right**: engines isolated from UI, typed worker protocol, per-tool lazy loading (~103kB first-load), static export = trivially scalable hosting.
2. **Honest core behaviors where it counts**: balanced compression provably never grows files; consistent encrypted-PDF policy with clear errors; unlock does a correct rebuild; deletion/split outputs are genuine rebuilds (removed pages truly gone).
3. **Privacy-clean by construction** (verified above) — a real, demonstrable advantage over iLovePDF/Smallpdf/Sejda whose uploads are architectural.
4. **Breadth already covers the commodity long tail** — 34 slugs including office conversions, which many browser-only competitors lack entirely.
5. **Fast deploys, MIT license, zero infra cost.**

## C. Current product weaknesses (summary ranked by user impact)

1. Compression flagship doesn't compress images (bug #1) — highest-traffic surface.
2. Three broken tools ship to production (bug #2) — trust damage when hit.
3. No editor, no OCR, no redaction, no signing — the four things feedback and search demand most.
4. Conversion quality (Word/Excel/PPT) is far below what the category expects; will generate disappointment, not delight.
5. Memory/perf cliffs on large files; fake cancellation; blob leaks.
6. SEO underpowered relative to ambition (no sitemap/structured data/canonicals/content depth).
7. Test suite gives false confidence (image-engine tests don't test the engine; workers/components untested; CI has no gates).
8. Brand dilution risk: 34 shallow tools, several trivial filters, overlapping resizers.

## D. User pain-point matrix (feedback → current state → gap)

| Feedback | Pain | Our current state | Competitor state | Gap severity |
|---|---|---|---|---|
| B: OCR quality for data extraction | High | **None** | Cloud/paid mostly (Adobe, iLovePDF Pro); ScoutMyTool has basic Tesseract | 🔴 High — and our best differentiation opportunity |
| C: Compression quality | High | Broken beyond object streams (bug #1) | Decent cloud compression w/ limits (25MB free iLovePDF) | 🔴 High — fix + make flagship |
| D/G: Editing painful, users flee to Acrobat | Very high | **None** | Sejda best-in-class freemium (server-side); Acrobat gold standard | 🔴 High — phase it honestly |
| E: Font mismatch | High | N/A (we don't edit text yet) | Industry-wide failure mode | 🟠 Must be designed-in before any text editing ships |
| F: Cover ≠ remove (redaction) | High | Crop is reversible; nothing else | Acrobat paid; DropFile browser redaction exists; big freemium names absent | 🟠 Strong differentiation slot |
| H: PDF→Word/Excel demand | High | Naive versions ship | Adobe best; others mediocre | 🟡 Improve with benchmarks, don't over-promise |
| H: Large files / mobile / compat | Medium-high | Untested; known memory cliffs | Server tools offload the problem; we own it | 🟡 Engineering discipline item |
| H: e-signatures | Medium-high | None | Many upload-based free options | 🟢 Quick win with privacy angle |
