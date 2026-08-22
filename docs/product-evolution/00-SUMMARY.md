# Product Evolution — Summary, Scorecard & Roadmap

> Decision layer. Read this first; deep detail lives in:
> - [01-AUDIT.md](./01-AUDIT.md) — current architecture audit (deliverables A–D)
> - [02-COMPETITORS-STRATEGY.md](./02-COMPETITORS-STRATEGY.md) — gap analysis + moat (E, G, H)
> - [03-ARCHITECTURES.md](./03-ARCHITECTURES.md) — flagship designs + plans (I–V)
>
> Status: **PLAN ONLY — no code changed.** Date: 2026-08-21.

---

## 0. Executive verdict (the honest part)

1. **The product currently lies to users in one place and silently fails in three.**
   - `compressPdf` "Strong"/"Maximum" levels are a verified no-op (`'/DCTDecode'` vs `'DCTDecode'` string bug, `packages/pdf-engine/src/index.ts:442-447`) while the UI promises 20–60% savings. This is the single worst finding: compression is our #1 SEO surface and it doesn't do what the label says.
   - Three shipped tools are broken at runtime due to worker op-name drift: `image-bg-remover` (no algorithm exists anywhere in the repo), `image-text` (export throws), `image-circle` (op mismatch `circle` vs `circle-crop`).
2. **"Private & local" is no longer a moat by itself.** Multiple browser-only competitors already market it (ScoutMyTool, DropFile, GN PDF, PeacefulPDF). It remains *table stakes* and a real advantage over iLovePDF/Smallpdf/Sejda — but differentiation must come from **quality, verification, and workflows**, not from the privacy claim alone.
3. **34 tools is past the point of diminishing returns.** Several are trivial filters that dilute the brand (grayscale/blur/sharpen/brightness), several overlap (resizer vs resize-for-purpose), and quality per tool is uneven. The next phase must *deepen*, not widen.
4. **The right flagship bets** (scored below): fix-and-rebuild **Compression**, ship **OCR with confidence UX**, ship **true Redaction with verification**, ship **Signing**, then an **overlay PDF Editor**. These map directly onto the real user feedback (B, C, F, G) and are all technically honest in a browser.
5. **Things we should NOT build:** standalone QR generator suite (commodity, scored 5.66 — lowest), AI chat-with-PDF (requires servers → breaks positioning), handwriting-OCR promises (Tesseract ≈45% on cursive — would be dishonest), "unlimited file size" marketing (untested), ML background removal (170MB+ model downloads on a Pages site).

---

## F. Feature priority scorecard

Weights: Pain .12 · Gap .08 · Demand .08 · Biz .06 · Privacy .10 · Feasibility .12 · PerfRisk .04 (10 = low risk) · Mobile .04 · Cost .04 (10 = cheap) · Differentiation .16 · Retention .06 · SEO .06 · Revenue .04.

| # | Candidate | Pain | Gap | Demand | Biz | Priv | Feas | Perf | Mob | Cost | Diff | Ret | SEO | Rev | **Score** | Tier |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | High-quality PDF compression (v2) | 9 | 7 | 10 | 7 | 10 | 7 | 6 | 7 | 6 | 8 | 8 | 9 | 6 | **8.00** | **P1 (fix is P0)** |
| 2 | OCR + text extraction (confidence UX) | 9 | 8 | 9 | 7 | 10 | 7 | 6 | 6 | 5 | 8 | 8 | 9 | 6 | **7.92** | **P1** |
| 3 | True redaction + verification | 8 | 9 | 6 | 6 | 10 | 6 | 7 | 6 | 5 | 10 | 7 | 7 | 5 | **7.60** | **P1** |
| 4 | Visual editor — phase 1 (overlay add/annotate/page ops) | 9 | 7 | 9 | 8 | 9 | 6 | 5 | 5 | 3 | 7 | 9 | 9 | 7 | **7.48** | **P1** |
| 5 | Electronic signing (draw/type/upload) | 7 | 6 | 8 | 8 | 9 | 9 | 9 | 7 | 9 | 5 | 7 | 8 | 7 | **7.40** | **P1** |
| 6 | Image compression v2 (perceptual presets, target size) | 7 | 6 | 9 | 6 | 10 | 8 | 7 | 8 | 7 | 5 | 7 | 8 | 5 | **7.14** | **P1/P2** |
| 7 | Invoice/document extraction workflow | 8 | 8 | 6 | 8 | 10 | 5 | 6 | 5 | 4 | 9 | 8 | 6 | 7 | **7.32** | **P2** (needs OCR) |
| 8 | Smart workflow suggestions ("this looks like an invoice…") | 6 | 8 | 4 | 7 | 10 | 8 | 9 | 8 | 7 | 8 | 8 | 4 | 5 | **7.22** | **P2** |
| 9 | Editor phase 2 — edit existing text + font handling | 9 | 8 | 8 | 8 | 9 | 3 | 4 | 4 | 2 | 8 | 9 | 8 | 7 | **7.08** | **P2 spike-gated** |
| 10 | PDF→Excel v2 (real table detection) | 8 | 7 | 8 | 7 | 9 | 6 | 6 | 6 | 5 | 6 | 7 | 9 | 6 | **7.04** | **P2** |
| 11 | PDF→Word v2 (structure, headings, images) | 8 | 6 | 9 | 6 | 9 | 5 | 6 | 6 | 5 | 5 | 6 | 9 | 5 | **6.60** | **P2** |
| 12 | PWA / offline mode | 5 | 6 | 4 | 5 | 9 | 7 | 8 | 9 | 7 | 4 | 8 | 3 | 3 | **5.82** | P3 |
| 13 | QR suite (generator/scanner/add-to-PDF) | 4 | 3 | 6 | 4 | 9 | 10 | 9 | 9 | 9 | 2 | 4 | 6 | 3 | **5.66** | P3 (fold into editor only) |

Tier rule: **P0** = stop active harm / trust repair. **P1** ≥ ~7.4 or strategic flagship. **P2** 6.6–7.4. **P3** < 6.6.

---

## W. Roadmap

### P0 — MUST BUILD/FIX (trust repair; ship as one release)

| Task | Problem | Approach | Key files |
|---|---|---|---|
| P0.1 Fix compression honesty | Strong/Maximum are no-ops while UI promises 20–60% | Short term: implement real JPEG-stream recompression (see 03 §L) OR relabel levels to structural-only until v2 lands. Add regression test asserting output bytes of image streams actually change | `packages/pdf-engine/src/index.ts`, `PdfCompressorTool.tsx` |
| P0.2 Fix/remove broken tools | bg-remover has no algorithm; add-text export throws; circle op mismatch; GIF target throws | Implement honest color-distance flood-fill bg removal (solid backgrounds, labeled as such); wire `add-text` flatten op; rename op to `circle-crop` + fix opts; drop GIF from converter targets | `BackgroundRemoverTool.tsx`, `ImageTextTool.tsx`, `CircleImageTool.tsx`, `image.worker.ts`, `ImageConverterTool.tsx` |
| P0.3 Object-URL leak sweep | ~15 components create blob URLs in render without revoke → memory growth on long sessions | Central `useBlobUrl` hook; revoke on unmount/replacement | `PdfResultView.tsx`, `CircleImageTool.tsx`, `BackgroundRemoverTool.tsx`, `ImageSharpen/Blur/Brightness/Grayscale/Flip/Rotate/Cropper/Resizer/QualityAnalyzerTool.tsx`, `JpgToPdfTool.tsx`, `PassportPhotoTool.tsx`, `OfficeConvertCard.tsx` |
| P0.4 Real cancellation | Cancel leaves promise unsettled; UI wedges in "running" | Settle promise on cancel; add cooperative abort checks in batch loops | `hooks/useWorker.ts`, both workers |
| P0.5 CI quality gates | Deploys run with zero tests/typecheck | Add `npm test` + `turbo typecheck` job before deploy; fail build on regression | `.github/workflows/deploy-pages.yml` |
| P0.6 SEO fundamentals | No sitemap/robots/canonical/JSON-LD; README says 23 tools (there are 34) | `app/sitemap.ts`, `app/robots.ts`, canonical+OG metadata helper, FAQPage JSON-LD on top tools, fix README count | `apps/web/app/*`, `lib/seo.ts`, `README.md` |
| P0.7 Claims audit | Copy promises things code doesn't do ("removes metadata", "reduces resolution", "100% accuracy" risk) | Copy pass against verified behavior; precise privacy language ("processed locally in your browser") | tool definitions + tool components |
| P0.8 Repo hygiene | Dead `pdf-lib` dep; 1.08MB generated worker committed; orphaned tsconfig.base.json | Remove dead dep; gitignore `apps/web/public/pdf.worker.min.js` (copy at build — already scripted); wire packages tsconfigs or delete base | `package.json`s, `.gitignore`, tsconfigs |

### P1 — HIGH IMPACT flagships (order = implementation order)

1. **Compression v2** — quality-first adaptive engine: hybrid image-XObject recompression (JPEG q search + DPI cap), rasterize fallback for scanned pages, target-size mode, before/after preview. *(03 §L)*
2. **OCR + Extract Text** — Tesseract.js lazy-loaded, pdf.js page render → preprocess → recognize → word-level confidence overlay → TXT/JSON/searchable-PDF export. Never claim 100%. *(03 §I)*
3. **Sign PDF** — draw/type/upload signature, place/resize, date/name, flatten via pdf-lib. Label: electronic signature, not cryptographic. *(03 §O)*
4. **Redact PDF** — mark areas → flatten (rasterize-page fallback first, surgical stream edit later) → verify by re-extracting text → report. *(03 §N)*
5. **Editor phase 1** — overlay editor: add text/images/shapes/highlight/freehand, move/resize/delete own objects, page rotate/delete/reorder/duplicate, undo/redo. Explicitly NOT existing-text editing yet. *(03 §J)*
6. **Image compression polish** — perceptual presets + target size shared with PDF engine work. *(03 §L.5)*

### P2 — IMPORTANT

- Invoice extraction workflow (classification heuristics → field extraction → verification UI → CSV/XLSX/JSON) *(03 §M)*
- Smart workflow suggestions on upload (scanned? invoice-like? huge image?) *(03 §H of arch doc §23)*
- PDF→Excel v2: ruling-line + clustering table detection, numeric normalization *(03 §P)*
- PDF→Word v2: column detection, heading inference, image extraction *(03 §P)*
- Large-file matrix testing (10–250MB × browsers) + thumbnail virtualization + transferables *(03 §R)*
- Mobile deep pass on critical flows (upload/preview/select/crop/sign/download) *(03 §S)*
- Guides content for flagship tools (real unique value only) *(03 §V)*
- Editor phase 2 spike: glyph-position text replacement + font detection/fallback warnings *(03 §J.6)*

### P3 — FUTURE

- PWA/offline, QR folded into editor, AVIF encode, pdfjs-dist upgrade (v3.11 → current), tool consolidation (merge trivial filters into one Adjust tool behind existing slugs), analytics decision (none today; if ever, cookieless + aggregate-only events listed in 03 §Privacy).

---

## X. Exact files to change (by initiative)

**P0**
- `packages/pdf-engine/src/index.ts` (compression fix + tests), `packages/pdf-engine/src/index.test.ts`
- `apps/web/components/tools/{PdfCompressorTool,BackgroundRemoverTool,ImageTextTool,CircleImageTool,ImageConverterTool}.tsx`
- `apps/web/workers/image.worker.ts` (add `remove-background`, `add-text`; fix circle dispatch)
- `apps/web/hooks/useWorker.ts`
- New: `apps/web/hooks/useBlobUrl.ts` + edits in ~15 tool components (list in 01-AUDIT §5)
- `.github/workflows/deploy-pages.yml`
- New: `apps/web/app/sitemap.ts`, `apps/web/app/robots.ts`, `apps/web/lib/seo.ts`
- `apps/web/lib/tools/definitions.ts` (copy fixes), `README.md`
- Root + package `package.json`s, `.gitignore`

**P1 Compression v2**
- `packages/pdf-engine/src/index.ts` (+ new `packages/pdf-engine/src/compress.ts`), `packages/shared/src/index.ts` (payload types)
- `apps/web/workers/pdf.worker.ts`, `apps/web/lib/pdfjs.ts` (page rasterizer), `apps/web/components/tools/PdfCompressorTool.tsx`
- New: `docs/benchmarks/compression-dataset.md`, `scripts/bench-compress.mjs`

**P1 OCR**
- New: `packages/ocr-engine/` (wrapper around tesseract.js: preprocess, recognize, confidence mapping)
- New: `apps/web/workers/ocr.worker.ts`, `apps/web/public/tesseract/` (self-hosted wasm + traineddata)
- New: `apps/web/components/tools/OcrPdfTool.tsx`, registry entries in `lib/tools/{definitions,registry}.tsx`
- `apps/web/lib/pdfjs.ts` (render-to-canvas at DPI), searchable-PDF writer in `packages/pdf-engine`

**P1 Sign / Redact / Editor**
- New: `apps/web/components/editor/` (AnnotationCanvas, handles, undo stack), `apps/web/components/tools/{SignPdfTool,RedactPdfTool,EditPdfTool}.tsx`
- `packages/pdf-engine` (flatten ops, redaction burn + verify, signature stamping)
- `packages/shared/src/index.ts` (new payloads)

**P2**
- `apps/web/lib/office.ts` (table detection, reading order), `packages/file-utils` (numeric normalization)
- New: `apps/web/lib/classify.ts` (document/invoice heuristics), suggestion UI in `FileUploader.tsx`/`ToolWorkspace.tsx`
- `apps/web/components/ui/pdf-preview-panel.tsx` + `PageGrid.tsx` (virtualization)

---

## Y. Implementation order (milestones with acceptance criteria)

| # | Milestone | Acceptance criteria |
|---|---|---|
| 1 | P0 stabilization | All vitest green incl. new compression regression test; no console errors on any of 34 tool pages (Playwright smoke); cancel works; CI runs test+typecheck before deploy; sitemap live |
| 2 | Compression v2 | Benchmark set (25 mixed PDFs): balanced ≥ current savings; strong/maximum show real measured reductions with SSIM-style quality gate; target-size mode lands within ±15% or reports honestly; before/after preview shipped |
| 3 | OCR | Clean-printed English benchmark ≥95% char accuracy disclosed per-doc with confidence heatmap; searchable-PDF round-trip opens in Acrobat with selectable text; model assets self-hosted; zero runtime third-party requests (network regression test) |
| 4 | Sign | Place/resize/download works desktop+mobile touch; flattened output renders identically in Chrome/Firefox/Edge; legal disclaimer copy shipped |
| 5 | Redact | Verification step proves removed strings absent via post-export text extraction; unredacted page content untouched; honest warning when rasterization fallback degrades selectability |
| 6 | Editor P1 | Undo/redo across all ops; objects are user-added only; page ops reuse existing engine functions; 60fps pan/zoom on 50-page doc; mobile touch targets ≥44px |
| 7 | Benchmarks published internally | `docs/benchmarks/` has reproducible numbers for compression/OCR/conversion before ANY marketing claim |

Rule enforced throughout: **one flagship per release cycle, benchmarked, reviewed — never a mega-PR.**

---

## What we will NOT build (and why)

| Rejected | Reason |
|---|---|
| Standalone QR generator/scanner pages | Commodity everywhere; score 5.66; dilutes focus. Only revisit as "Add QR to PDF" inside editor |
| AI chat-with-your-PDF | Requires server/LLM → breaks the core privacy architecture claim |
| Handwriting OCR marketing | Tesseract ≈45% on cursive — promising it would be dishonest |
| ML background removal (U²-Net etc.) | 40–170MB model download unacceptable for casual use on Pages; honest flood-fill covers the solid-background case |
| "Unlimited file sizes" claims | Untested; memory cliffs exist (see audit). Advertise tested limits instead |
| Existing-text editing without font strategy | Feedback E says font mismatch is a top complaint; shipping naive text swap would repeat the industry's worst failure mode. Spike-gated |
| More single-purpose filter tools | Widening is done. Deepening starts now |
