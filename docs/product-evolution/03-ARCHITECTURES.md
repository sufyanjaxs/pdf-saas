# 03 — Flagship Architectures & Plans (Deliverables I–V)

> Companion to [00-SUMMARY.md](./00-SUMMARY.md) (scorecard/roadmap),
> [01-AUDIT.md](./01-AUDIT.md) (current state), [02-COMPETITORS-STRATEGY.md](./02-COMPETITORS-STRATEGY.md).
> Each design states what is realistic in a browser — and what is not.

---

## I. OCR architecture

**Library choice (benchmarked decision, not assumption).** Verified landscape:

| Option | Verdict |
|---|---|
| **Tesseract.js v5/v6 (WASM)** | ✅ Primary. ~96–99% char accuracy on clean printed text; 100+ languages; per-word confidence + bboxes; worker-friendly; models cached in IndexedDB. Weak: handwriting (~45%), complex layout, CJK without right model. |
| PaddleOCR browser ports (ONNX Runtime Web / WebGPU) | Better layout/CJK/scene text but heavier orchestration + larger models. Revisit later as "pro" mode only if users need it. |
| TrOCR/docTR/Surya (transformers) | GPU/WebGPU-oriented, hundreds of MB — wrong fit for a casual Pages-hosted tool. ❌ for now. |

### Pipeline
```
Upload PDF/image
→ pdf.js render page → canvas @ chosen DPI (default 200; user: 150/200/300)
→ preprocess (grayscale → Otsu binarize; optional deskew via projection profile)
   [all in ocr.worker.ts via OffscreenCanvas; never main thread]
→ Tesseract recognize (per page, sequential with progress; languages: eng first,
   more traineddata self-hosted and opt-in)
→ confidence mapping: word-level conf + bbox from tesseract result
→ post-process: join lines w/ reading order heuristics (column detection = x-gap clustering)
→ UI: rendered page + color-coded confidence overlay (green ≥85, amber 60–84, red <60)
     click word → correct inline before export
→ exports: TXT · JSON (words+conf+bbox) · searchable PDF
```

### Searchable PDF
Render original page image + draw invisible text layer. pdf-lib can emit text with
render mode 3 (invisible) via low-level `pushOperators` — **needs a 1-day spike**;
fallback if blocked: ship TXT/JSON first, searchable PDF follows.

### Honest-accuracy rules
- Never display or market "100%". Show per-document average confidence and warn below thresholds.
- Copy states limits up front: poor scans/handwriting degrade results.
- Model assets **self-hosted** under `apps/web/public/tesseract/` (wasm core + per-lang traineddata, lazy-fetched, cacheable) — keeps the zero-third-party-request property.

**New files:** `packages/ocr-engine/`, `apps/web/workers/ocr.worker.ts`,
`components/tools/OcrPdfTool.tsx`, registry entries.

---

## J. PDF editor architecture

Scope honesty: editing *existing* paragraph text in-browser is the industry's
worst failure mode (font mismatch — feedback E). Phase it.

### Phase 1 (P1): overlay editor — "add & annotate"
```
pdf.js renders page to canvas (virtualized)
+ absolutely-positioned DOM/SVG object layer (user-created objects ONLY):
  text boxes · images · shapes (rect/ellipse/line/arrow) · highlights · freehand ink
  each: move / resize (8 handles, pointer events) / style / delete / z-order
Page ops (reuse existing engine fns): rotate · delete · duplicate · reorder · insert blank
Undo/redo: command stack {do, undo} snapshots of document model (JSON), cap 100
Export: serialize objects → pdf-lib draw ops (embedFont standard fonts for added text;
        embedPng/Jpg for images; drawSvgPath-ish for shapes; ink → PNG stamp)
        → flatten onto pages → download
```
- Objects are stored in a doc model `{page, type, rect, style, payload}` — never mutate source content.
- Pan/zoom shared with existing `image-canvas`/zoom-controls patterns; virtualize thumbnails (`PageGrid`) before editor ships.
- Touch: handles ≥44px, two-finger pan/zoom, long-press context menu.

### Phase 2 (P2/P3, spike-gated): edit existing text
1. pdf.js `getTextContent` gives glyph runs + transforms → hit-test clicks to text runs.
2. Replacement strategy: remove/cover original run, draw replacement with **detected font size/color/alignment**; font matching via embedded-font name lookup → closest available (standard 14 or bundled open fonts); **if no good match: visible warning + side-by-side preview**, never silent substitution.
3. Only proceed past spike if fidelity on the benchmark set is acceptable; otherwise keep scope at Phase 1 and say so.

Fraud-safety note: editor copy positions this for legitimate correction/form-filling/annotation; no features that automate falsification (e.g., no "recalculate totals to match").

---

## K. Document extraction architecture (structured data)

Built ON the OCR pipeline (K depends on I):

```
Text (native pdf.js extract OR OCR words+boxes)
→ classification: heuristic scorecard (keywords "invoice/receipt/statement",
   date formats, currency symbols, table-like line structure) → type guess + confidence
→ field extraction per type:
   invoice: number/date/seller/customer/currency/line items/tax/subtotal/total
   (regex + positional rules: right-aligned amounts, label:value pairs, column x-alignment)
→ EVERY extracted field carries confidence + source bbox (highlight on hover)
→ verification UI: fields editable inline; low-confidence fields flagged; nothing auto-submitted
→ export: CSV · XLSX (exceljs, real cells) · JSON · DOCX summary
```

Hard rule: **never invent values.** Unfound field = empty + "not found", never guessed.
Line-item table extraction reuses the table detector from §P (Excel v2) — build once, use twice.

---

## L. Compression improvement plan

### L.1 Fix the lie (P0)
Repair or relabel Strong/Maximum immediately (bug: `'/DCTDecode'` comparison,
`packages/pdf-engine/src/index.ts:442-447`). Regression test must assert image
stream bytes actually change.

### L.2 Compression v2 engine (P1 flagship)
Quality-first adaptive strategy, hybrid by content:

```
Analyze PDF: enumerate image XObjects (Subtype/Image, Filter DCTDecode/FlateDecode,
             Width/Height/ColorSpace) + share of file bytes per category
Case A — image-dominated (typical scans/photos in PDFs):
  per image XObject:
    JPEG (DCTDecode): decode bytes → createImageBitmap → optional downscale to DPI cap
                      (max 150–200dpi effective) → re-encode JPEG binary-search quality
                      to tier target → replace stream (pdf-lib XObject swap)
    Flate images: decode raw params → canvas → same path
  text/vector streams untouched → text stays razor sharp
Case B — scanned flat pages where Case A can't help:
  offer explicit "rasterize pages" mode: render @ capped DPI, JPEG-encode, rebuild
  (clearly labeled: text becomes non-selectable)
Target-size mode: binary search over (quality, scale) to hit user KB goal ±15%,
                  report achieved size honestly if unreachable
Tiers: LIGHT (structural only) · BALANCED (q~0.75, mild downscale) · STRONG (q~0.6)
       · EXTREME (q~0.45 + aggressive downscale) · TARGET SIZE
UI: before/after page preview slider + saved% + estimated quality + per-tier expectations
    (replace today's invented percentages with measured ones)
```

Worker-only, transferable buffers, cooperative cancel checks between pages.

### L.3 Benchmarks before claims
`docs/benchmarks/compression-dataset.md`: 25-PDF corpus (text-native, scanned, mixed,
already-compressed) × tiers → table of size/quality/time. Marketing numbers come
from this file or they don't ship.

### L.5 Image compression polish (rides the same work)
Perceptual presets (photo/screenshot/graphic already exist), target-size mode parity,
WebP quality search reuse, AVIF encode behind capability check (P3).

---

## M. Invoice workflow plan

Sequence: after OCR (I) + extraction (K) land.

1. **Extract (P2)**: upload invoice → classify → fields w/ confidence → verify/edit → CSV/XLSX/JSON. This alone beats most free tools.
2. **Correct & re-export (P2/P3)**: verified fields can regenerate a clean corrected PDF (overlay corrections on original) — positioned explicitly as *correction*, with an audit note page option ("corrected on …" footer, user-toggleable).
3. **Batch (P3)**: queue invoices → one XLSX ledger.

Anti-fraud guardrails: no auto-total rewriting, no template for altering issued invoices; UI copy says correction/creation of your own documents.

---

## N. Redaction plan (true removal, staged)

Definitions enforced in UI: whiteout (cosmetic) ≠ redaction (removal). We ship redaction.

### Stage 1 (P1) — burn-and-verify (robust)
```
Mark rects on rendered page (same interaction layer as editor)
→ Apply: rasterize affected PAGE(S) at high DPI with rects filled black
         (text/image/annotation underneath genuinely gone from pixels)
→ strip annotations intersecting rects; optionally strip metadata/attachments
→ VERIFY step: pdf.js text extraction on output; assert marked strings absent;
   report "verified removed: ✓ …" or warning if residue detected
→ honest tradeoff shown BEFORE apply: redacted pages become non-selectable images
```

### Stage 2 (P2) — surgical text removal for common cases
For unencrypted simple content streams: locate text-showing operators (Tj/TJ) whose
glyph runs intersect rects (via getTextContent transforms), rewrite stream without
them, fill rect. Fall back to Stage 1 rasterization when stream complexity defeats
analysis — always with a clear notice of which method was used per page.

Verification report is the differentiator: nobody else shows proof.

---

## O. Signature plan (electronic, honest)

```
Upload PDF → signature pad modal: Draw (pointer/touch pressure-agnostic smoothing)
                              | Type (handwriting-style webfonts, bundled)
                              | Upload PNG (transparency preserved)
→ place on page (drag/resize/rotate), optional date/name/title stamps
→ Apply: flatten into page via pdf-lib (PNG embed) → download
```
- Copy discipline: "**Electronic signature** — a visible mark you apply yourself. Not a cryptographic digital certificate; check local laws for your use case." No legal validity claims.
- Optional (P2): "Sign here" field detection from existing AcroForm fields.
- All local — the privacy angle vs every upload-based e-sign site is the marketing hook.

---

## P. PDF→Word / Excel improvement plan

Current state is naive (audit §7). Improve with benchmarks, not promises.

### Excel v2 (P2)
```
pdf.js items (+OCR fallback for scans) → cluster into lines (y-tolerance)
→ detect columns via x-position clustering per band
→ detect ruling lines via vector ops (pdf.js operator list / OPS) when present
→ merge evidence → cell grid → numeric normalization (currency, thousands separators,
   dates → ISO) with original string preserved in adjacent "raw" column toggle
→ exceljs workbook: one sheet/page-range, real cells, header inference (bold/large text)
```
Benchmark: 20-PDF table corpus (bordered/borderless/multi-page/scanned); publish accuracy internally before claiming anything.

### Word v2 (P2)
Reading order via column detection (reuse above) → paragraphs; heading inference from font-size clusters (map to Heading 1–3); extract embedded images → place inline; tables → docx tables when grid detected. Scanned input routes to OCR flow automatically with a notice. Honest landing copy: "best for text-focused documents; complex layouts may need touch-up."

### PPT (no change, de-prioritized)
Image-slide approach stays; not a flagship; keep honest description.

---

## Q. QR plan

**Not a standalone suite** (scored 5.66 — commodity). Only entry point: inside the
editor (Phase 1.5): "Add QR to PDF" → types URL/text/Wi-Fi/vCard/email → place like
any object → flattened at export. Generator lib lazily imported (~10kB). Scanner:
skip entirely unless user demand appears.

---

## R. Performance plan

1. **Transport**: switch image worker payloads base64 → transferable `Uint8Array`/`ArrayBuffer`; adopt transferables for PDF paths too (postMessage list).
2. **Virtualization**: `renderThumbnails` → windowed rendering (render visible ± buffer; IntersectionObserver) in PageGrid/pdf-preview-panel before any large-doc feature ships.
3. **Cancellation**: cooperative abort tokens checked between pages/items; settle promises on cancel (P0).
4. **Memory**: revoke blob URLs centrally (`useBlobUrl`); drop merger's permanent thumbnail state; dimension caps with friendly errors (e.g., refuse >8000×8000 resize inputs with guidance); release engine intermediate buffers.
5. **Budgets**: first-load ≤110kB; any tool chunk ≤300kB gz except OCR (lazy + cached models); interaction-to-preview <1s for 20MB PDF on mid-range hardware; CI fails on budget regression.
6. **Large-file matrix** (P2): 10/25/50/100/250MB × Chrome/Firefox/Edge/Safari × desktop/mid-mobile/low-mobile; measure time, peak memory (performance.memory where available), crash rate; publish tested limits instead of "unlimited".

## S. Mobile plan

Design touch-first for six critical flows: upload, page select/thumbnails, crop, sign placement, OCR review, download.
- Handles/hit areas ≥44px; pointer events everywhere (crop-overlay already does); pinch-zoom on canvas views; sticky primary action bar; bottom-sheet style controls on narrow viewports.
- File access: accept attribute + camera capture hint for scan/photo inputs.
- Test matrix: iOS Safari + Android Chrome on real devices each release; Playwright touch emulation in CI smoke.
- Do NOT simply shrink desktop panels — ToolWorkspace gets an explicit mobile layout (preview collapsed to drawer).

## T. Privacy plan

1. Keep zero telemetry default. If analytics ever added: cookieless, aggregate events only (tool_opened, processing_completed/failed, download_completed, tool_to_tool_nav) — never file names/sizes/content; documented publicly.
2. **Network regression test** (new, P0): Playwright collects all non-static requests during a scripted tool run; test fails if any request leaves origin (guards the core claim forever).
3. Precise language standard: "processed locally in your browser"; avoid absolute guarantees we can't verify; OCR model downloads disclosed as asset fetches (not uploads).
4. No cookies/localStorage beyond user-visible prefs + OCR model cache; document both.
5. Future server features (if ever): visually segregated + labeled "requires upload", never silently mixed into local tools.

## U. Testing plan

| Layer | Today | Target |
|---|---|---|
| Engines (vitest node) | pdf-engine good; image-engine illusory | Real coverage incl. compress strong/max regression, WEBP/GIF rejection, encrypted errors, crop/redact verification |
| Workers | none | Dispatch-table unit tests (would have caught 3 broken tools) + op-name↔payload-type contract test generated from shared types |
| Hooks/lib | none | useWorker cancel semantics; office converters against fixture files |
| Components/E2E | ad-hoc, uncommitted | Playwright committed: smoke all 34 pages + full flows for 6 critical tools (split, merge, compress, ocr, sign, redact) incl. corrupted/empty/oversized fixtures |
| Fixtures | empty dir | `tests/fixtures/`: valid/corrupt/empty/large/scanned/multilingual/transparent/text-heavy samples (small synthetic files committed) |
| Benchmarks | none | `docs/benchmarks/`: compression corpus, OCR dataset (clean print + degraded), conversion corpora; reproducible scripts in `scripts/` |
| CI gates | build only | typecheck + vitest + Playwright smoke before Pages deploy |

## V. SEO plan

1. Fundamentals (P0): `sitemap.ts` (all 34 + future guides), `robots.ts`, canonical URLs, OG/Twitter metadata helper, JSON-LD (`SoftwareApplication` per tool, `FAQPage` where FAQs exist), fix README count.
2. Flagship depth pages (P1+, only with genuine unique value): `/tools/ocr-pdf`, `/tools/sign-pdf`, `/tools/redact-pdf`, `/tools/edit-pdf` + upgrade copy of existing compress/excel pages with real benchmark-informed claims, how-it-works sections, FAQ blocks answering actual queries (is it safe? accurate? file limits?).
3. Guides hub (P2): compress-without-quality-loss, redact-a-pdf-properly, ocr-invoices, extract-tables — each tied to a tool CTA; no thin doorway pages.
4. Content rule: a page ships only if it teaches something competitors' pages don't (verification UX, privacy architecture, benchmarks are our unique material).
5. Measure: Search Console only (privacy-consistent); no keyword spam; slugs stay stable.
