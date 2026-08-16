'use client'

import { fileToUint8Array, uint8ToBase64, extensionFromMime } from '@pdf-saas/file-utils'
import type { ImageBlobPayload } from '@pdf-saas/shared'

export async function fileToImagePayload(file: File): Promise<ImageBlobPayload> {
  const bytes = await fileToUint8Array(file)
  return { bytes: uint8ToBase64(bytes), mime: file.type, name: file.name }
}

export function resultBlobUrl(mime: string, bytes: Uint8Array | string): string {
  const arr = typeof bytes === 'string' ? atobToBytes(bytes) : bytes
  return URL.createObjectURL(new Blob([arr as BlobPart], { type: mime }))
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
