import { notFound } from 'next/navigation'
import { toolDefinitions, getTool } from '@/lib/tools/definitions'
import ToolPageClient from '@/components/tools/ToolPageClient'

export function generateStaticParams() {
  return toolDefinitions.map((t) => ({ slug: t.slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const tool = getTool(params.slug)
  if (!tool) return { title: 'Tool not found' }
  return {
    title: `${tool.name} — Free Online Tool`,
    description: tool.description,
    keywords: tool.keywords.join(', '),
  }
}

export default function ToolPage({ params }: { params: { slug: string } }) {
  const tool = getTool(params.slug)
  if (!tool) notFound()
  return <ToolPageClient slug={params.slug} />
}
