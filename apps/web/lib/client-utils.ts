'use client'

import { useEffect, useState } from 'react'
import { fileToUint8Array, uint8ToBase64, extensionFromMime } from '@pdf-saas/file-utils'
import type { ImageBlobPayload } from '@pdf-saas/shared'

export async function fileToImagePayload(file: File): Promise<ImageBlobPayload> {
  const bytes = await fileToUint8Array(file)
  return { bytes: uint8ToBase64(bytes), mime: file.type, name: file.name }
}

/**
 * Registry of blob URLs created for tool results. Results are replaced
 * wholesale whenever a tool runs again or resets, so revoking everything in
 * the registry at those moments is safe and prevents unbounded memory growth
 * during long sessions.
 */
const resultUrls = new Set<string>()

export function resultBlobUrl(mime: string, bytes: Uint8Array | string): string {
  const arr = typeof bytes === 'string' ? atobToBytes(bytes) : bytes
  const url = URL.createObjectURL(new Blob([arr as BlobPart], { type: mime }))
  resultUrls.add(url)
  return url
}

/** Revoke every tracked result blob URL. Call when results are replaced/cleared. */
export function releaseResultUrls(): void {
  for (const url of resultUrls) URL.revokeObjectURL(url)
  resultUrls.clear()
}

/**
 * Object URL lifecycle for a single Blob|File source (previews, probes).
 * Creates a URL, revokes the previous one on change, and revokes on unmount.
 */
export function useBlobUrl(source: Blob | File | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!source) {
      setUrl(null)
      return
    }
    const objectUrl = URL.createObjectURL(source)
    setUrl(objectUrl)
    return () => {
      URL.revokeObjectURL(objectUrl)
      setUrl((current) => (current === objectUrl ? null : current))
    }
  }, [source])

  return url
}

function atobToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

export function extForMime(mime: string): string {
  return extensionFromMime(mime)
}

export function defaultOutputName(inputName: string, suffix: string, mime: string): string {
  const dot = inputName.lastIndexOf('.')
  const base = dot === -1 ? inputName : inputName.slice(0, dot)
  return `${base}-${suffix}.${extensionFromMime(mime)}`
}
