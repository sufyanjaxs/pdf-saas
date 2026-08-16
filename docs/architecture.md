# Architecture

## Overview

The app is a **local-first, browser-only** processing pipeline. Files are read directly from the user's device, processed in Web Workers, and results are downloaded locally. No file ever leaves the browser.

```
┌────────────────────────────────────────────────────────────┐
│                         Browser                             │
│                                                            │
│   UI (React / Next.js)                                     │
│     │                                                      │
│     │  read File → FileUploader                            │
│     ▼                                                      │
│   Hook (usePdfWorker / useImageWorker)                     │
│     │  postMessage (typed payload)                         │
│     ▼                                                      │
│   Web Worker                                               │
│     ├─ pdf.worker  →  pdf-engine (pdf-lib)                 │
│     └─ image.worker → image-engine (Canvas/OffscreenCanvas)│
│     │  progress: {id, progress, label}                     │
│     ▼                                                      │
│   ResultPanel → downloadBlob()                             │
└────────────────────────────────────────────────────────────┘
```

## Processing pipeline

1. **File read** — `file-utils` validates the file (type, size, count) and converts it to a `Uint8Array`/base64 payload.
2. **Worker request** — the UI sends a typed `WorkerRequest` (see `packages/shared`) to the matching worker with `{ id, operation, payload }`.
3. **Work** — the worker dispatches to the engine package:
   - `pdf-engine` wraps [pdf-lib](https://github.com/Hopding/PDF-LIB) for split / merge / delete / extract / rotate / JPG→PDF / compress.
   - PDF rendering (thumbnails, PDF→JPG) uses [PDF.js](https://mozilla.github.io/pdf.js/) in a dedicated worker (`/pdf.worker.min.js`, copied into `public/` by `scripts/copy-pdfjs-worker.mjs`).
   - `image-engine` uses `createImageBitmap` + `OffscreenCanvas` (no DOM required, worker-compatible).
4. **Progress** — workers emit `WorkerProgress` messages; the UI renders a progress bar per step.
5. **Download** — results are returned as base64/bytes and downloaded via `downloadBlob()`.

## Concurrency model

- `useWorker` tracks one request per worker at a time and exposes `cancel()` (sends `{ signal: 'cancel' }`).
- The UI disables controls while running and clears state in `.finally`.

## PDF compression strategy

- **Balanced** — runs `PDFDocument.save()` with `useObjectStreams` true and false, keeps the smaller output, guaranteeing the result never grows.
- **Strong / Maximum** — additionally re-encodes embedded DCTDecode (JPEG) image streams via `OffscreenCanvas` to lower quality, then re-embeds. Browser-only (Web Worker has no DOM, so this path needs canvas APIs).

## Adding a tool

1. Define `ToolMeta` in `packages/shared`.
2. Add the operation + payload types.
3. Implement the engine function in `packages/pdf-engine` or `packages/image-engine`.
4. Dispatch the operation in the matching worker.
5. Create the tool component in `apps/web/components/tools/` and register it in `apps/web/lib/tools/registry.tsx`.

## Security & privacy

- No backend, no database, no analytics, no third-party file processing. Files are processed with fully client-side, MIT/Apache-licensed open-source libraries.
- No credentials or secrets are stored.

## Scaling to a server provider

Everything behind the worker hooks is abstracted so a server-side path can be added later without touching the UI:

1. Introduce a `ProcessingProvider` interface (`BrowserProvider`, `ServerProvider`).
2. `ServerProvider` posts to your API instead of a Web Worker; the request/response/progress protocol in `packages/shared` is transport-agnostic.
3. Swap the provider at runtime via config or feature flag.

This keeps v1 simple (zero infrastructure) while preserving a clear upgrade path.
