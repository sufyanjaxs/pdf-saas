import { notFound } from 'next/navigation'
import { toolDefinitions, getTool } from '@/lib/tools/definitions'
import { toolMetadata, toolJsonLd } from '@/lib/seo'
import ToolPageClient from '@/components/tools/ToolPageClient'

export function generateStaticParams() {
  return toolDefinitions.map((t) => ({ slug: t.slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const tool = getTool(params.slug)
  if (!tool) return { title: 'Tool not found' }
  return toolMetadata(tool.slug, tool.name, tool.description, tool.keywords)
}

export default function ToolPage({ params }: { params: { slug: string } }) {
  const tool = getTool(params.slug)
  if (!tool) notFound()
  const jsonLd = toolJsonLd(tool.slug, tool.name, tool.description)
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ToolPageClient slug={params.slug} />
    </>
  )
}
