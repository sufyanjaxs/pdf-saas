'use client'

import { getTool } from '@/lib/tools/definitions'
import { getToolComponent } from '@/lib/tools/registry'
import { ToolLayout } from '@/components/tools/ToolLayout'

export default function ToolPageClient({ slug }: { slug: string }) {
  const tool = getTool(slug)
  const Component = getToolComponent(slug)

  if (!tool || !Component) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
        <p className="text-6xl font-bold text-brand-600">404</p>
        <p className="mt-3 text-slate-500">Tool not found</p>
      </div>
    )
  }

  return (
    <ToolLayout tool={tool}>
      <Component />
    </ToolLayout>
  )
}
