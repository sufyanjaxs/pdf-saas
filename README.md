# PDF & Image Toolbox

A free, browser-only PDF and image toolbox. Everything runs locally in your browser — no uploads, no servers, no login, no waiting.

## Features

12 tools, split into two categories:

**PDF Tools**
- Split PDF
- Merge PDF
- Delete Pages
- Extract Pages
- Rotate PDF
- JPG → PDF
- PDF → JPG
- Compress PDF

**Image Tools**
- Compress Image
- Resize Image
- Crop Image
- Convert Image

## Why it's fast

- **100% local processing** — your files never leave the device. PDF operations run in a Web Worker with [pdf-lib](https://github.com/Hopding/PDF-LIB), rendering and PDF→JPG use [PDF.js](https://mozilla.github.io/pdf.js/), and image operations use the browser-native Canvas API.
- **No account, no sign-up** — open a tool and use it.
- **Lazy-loaded tools** — each tool page loads its code on demand, keeping first paint tiny.
- **Mobile friendly** — responsive UI, touch-friendly drag-and-drop.

## Tech stack

- [Next.js](https://nextjs.org/) 14 (App Router, SSG) + React 18 + [Tailwind CSS](https://tailwindcss.com/)
- [Turborepo](https://turbo.build/) workspaces — `apps/web` + shared `packages/*`
- [pdf-lib](https://github.com/Hopding/PDF-LIB) (MIT) — PDF manipulation
- [pdf.js](https://mozilla.github.io/pdf.js/) (Apache-2.0) — PDF rendering / thumbnails / PDF→JPG
- [Vitest](https://vitest.dev/) — unit tests for the engine packages

## Repository structure

```
packages/shared        Tool metadata + Web Worker protocol types
packages/file-utils    Validation, page ranges, formatting, download helpers
packages/pdf-engine    All PDF operations (split, merge, rotate, compress, ...)
packages/image-engine  Image operations (resize, crop, convert, compress)
apps/web               Next.js app — 12 tools + landing page
scripts                pdf.js worker copy script
```

## Getting started

```bash
npm install
npm run dev          # start dev server (http://localhost:3000)
```

Other commands:

```bash
npm run build        # production build (also copies the pdf.js worker)
npm start            # serve the production build
npm test             # run unit tests (Vitest)
npm run typecheck    # TypeScript checks across workspaces
npm run copy:pdfjs   # re-copy the pdf.js worker into apps/web/public
```

## Deploying

The app is fully static after build (`next build` produces static HTML). Deploy the `apps/web` output to any static/CDN host (Vercel, Netlify, Cloudflare Pages, GitHub Pages). Because processing is browser-side, no server runtime is required.

## Architecture notes

See [`docs/architecture.md`](docs/architecture.md) for the processing pipeline and how browser-local processing can be swapped for a server-side provider later.

## License

MIT — see [`LICENSE`](LICENSE).
