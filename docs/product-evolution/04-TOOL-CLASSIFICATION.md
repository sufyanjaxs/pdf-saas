# Tool Classification — Evidence-Based Audit (2026-08-22)

Method: every tool mapped to its worker op + engine implementation, then exercised
end-to-end by the Playwright functional gate (`zero-error-gate.js`, 34/34 pass with
real downloads validated). No classification is based on page loading alone.

## Verdict summary

| Class | Count | Tools |
|---|---|---|
| REAL + WORKING | 30 | all PDF page ops, compression, security, image suite |
| REAL + BASIC (depth roadmap) | 4 | pdf-to-word, pdf-to-excel, pdf-to-powerpoint, word-to-pdf |
| FAKE CONVERSION (extension rename) | 0 | — |
| PLACEHOLDER | 0 | — |

## The fake-conversion suspicion: DISPROVEN by code

`apps/web/lib/office.ts` — every office tool runs a genuine pipeline:

- **PDF → Word**: pdf.js `getTextContent()` per page → real `.docx` built with the
  `docx` library (heading + one paragraph per line). *Limit: text-only; no images,
  table structure, or font fidelity.*
- **PDF → Excel**: same extraction → real multi-column `.xlsx` via `exceljs`
  (Page / Line / Text columns). *Limit: no table/line detection yet (roadmap P2).*
- **PDF → PowerPoint**: each page rendered to JPEG @2x via pdf.js canvas → embedded
  as full-bleed image slides in a real `.pptx` (PptxGenJS). Image-slide output is a
  legitimate, industry-common technique — and is exactly what it claims.
- **Word → PDF**: mammoth `extractRawText` → real text layout onto A4 pages
  (`textToPdf`). *Limit: formatting lost.*

These are honest but shallow. They stay classified **REAL + BASIC** with depth work
queued on the P2 roadmap (reading order, tables, images) — NOT deleted.

## Per-tool registry (34)

PDF (14): splitter, merger, delete-pages, extractor, rotator, jpg-to-pdf, pdf-to-jpg,
compressor, protector, unlocker, watermark, page-numbers, cropper, organizer —
**REAL+WORKING** (engine ops verified at pdf.worker.ts:75-176).

Office (4): pdf-to-word, pdf-to-excel, pdf-to-powerpoint, word-to-pdf —
**REAL+BASIC** as above.

Image (16): compressor, resizer, resize-purpose, cropper, converter, text, passport,
circle, bg-remover (honest flood-fill, adaptive tolerance), quality (heuristic
analyzer), rotate, flip, grayscale, brightness, blur, sharpen — **REAL+WORKING**
(ops verified at image.worker.ts:195-590).

## Gaps vs. the expansion wishlist (NOT built yet — honest MISSING list)

OCR anything, invoice/receipt extraction, redaction (true removal), flatten,
metadata editor/viewer, sanitize, PDF repair, compare/diff, split-by-size,
extract-images, text/markdown→PDF, EXIF viewer/remover, color/font/page-size
analyzers. These enter the roadmap only when a real processing pipeline exists.

Rule enforced: nothing ships that can't answer "what processing happens to your file?"
