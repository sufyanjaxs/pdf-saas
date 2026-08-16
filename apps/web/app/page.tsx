import Link from 'next/link'
import { ShieldCheck, Zap, Lock } from 'lucide-react'
import { pdfTools, imageTools } from '@/lib/tools/definitions'
import { ToolIcon } from '@/lib/tools/icon-map'

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-b from-brand-50 via-white to-white">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center">
          <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            No sign-up · No upload · 100% private
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            PDF & Image Tools
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600">
            Fast. Free. No login. Every tool runs entirely in your browser — your files
            never leave your device.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-slate-600 shadow-sm ring-1 ring-slate-200">
              <Zap className="h-4 w-4 text-brand-500" /> Blazing fast
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-slate-600 shadow-sm ring-1 ring-slate-200">
              <Lock className="h-4 w-4 text-brand-500" /> Private by design
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-slate-600 shadow-sm ring-1 ring-slate-200">
              Free forever
            </span>
          </div>
        </div>
      </section>

      {/* Tools */}
      <section className="mx-auto max-w-5xl px-4 pb-20">
        <ToolSection title="PDF Tools" tools={pdfTools} />
        <div className="h-10" />
        <ToolSection title="Image Tools" tools={imageTools} />
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-8 text-center text-xs text-slate-400">
          <p>All processing happens locally in your browser using open-source engines (PDF.js, pdf-lib).</p>
          <p className="mt-1">Your documents are never uploaded, stored, or transmitted.</p>
        </div>
      </footer>
    </main>
  )
}

function ToolSection({
  title,
  tools,
}: {
  title: string
  tools: { slug: string; name: string; shortName: string; description: string; icon: 'file-split' | 'file-merge' | 'trash' | 'scissors' | 'rotate' | 'image-to-pdf' | 'pdf-to-image' | 'archive' | 'image-compress' | 'ruler' | 'crop' | 'refresh' }[]
}) {
  return (
    <div>
      <h2 className="mb-5 text-center text-sm font-semibold uppercase tracking-widest text-slate-400">
        {title}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tools.map((tool) => (
          <Link
            key={tool.slug}
            href={`/tools/${tool.slug}`}
            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
          >
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white">
              <ToolIcon name={tool.icon} className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-slate-900">{tool.name}</h3>
            <p className="mt-1 text-xs text-slate-500">{tool.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
