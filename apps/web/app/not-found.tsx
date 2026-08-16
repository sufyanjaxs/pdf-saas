import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="text-6xl font-bold text-brand-600">404</p>
      <h1 className="mt-3 text-2xl font-semibold text-slate-900">Tool not found</h1>
      <p className="mt-2 text-slate-500">The tool you are looking for does not exist.</p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
      >
        Back to all tools
      </Link>
    </div>
  )
}
