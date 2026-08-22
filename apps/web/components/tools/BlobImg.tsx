'use client'

import type { CSSProperties } from 'react'
import { useBlobUrl } from '@/lib/client-utils'

/**
 * <img> whose src comes from a lifecycle-managed object URL for the given
 * File/Blob. Use instead of `src={URL.createObjectURL(file)}` inline in
 * render bodies, which leaked a URL on every render.
 */
export function BlobImg({
  file,
  alt,
  className,
  style,
}: {
  file: File | Blob
  alt: string
  className?: string
  style?: CSSProperties
}) {
  const url = useBlobUrl(file)
  if (!url) return null
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={className} style={style} />
}
