'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { uid } from '@pdf-saas/file-utils'
import type { WorkerRequest, WorkerResponse, WorkerProgress } from '@pdf-saas/shared'

export interface WorkerHandle<TPayload = unknown, TResult = unknown> {
  /** Start an operation. Resolves with the worker's result data. */
  run: (operation: string, payload: TPayload) => Promise<TResult>
  cancel: () => void
  resetError: () => void
  running: boolean
  progress: number | null
  label: string
  error: string | null
}

/**
 * Generic Web Worker wrapper implementing a request/response protocol with
 * progress events. The worker factory must be created lazily by the caller so
 * the `new Worker(new URL(...))` literal stays statically analyzable by webpack.
 */
export function useWorker<TResult = unknown>(
  createWorker: () => Worker,
): WorkerHandle<unknown, TResult> {
  const workerRef = useRef<Worker | null>(null)
  const currentIdRef = useRef<string | null>(null)
  const resolveRef = useRef<((v: TResult) => void) | null>(null)
  const rejectRef = useRef<((e: Error) => void) | null>(null)

  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const worker = createWorker()
    workerRef.current = worker

    worker.onmessage = (ev: MessageEvent<WorkerResponse>) => {
      const msg = ev.data
      if (msg.id !== currentIdRef.current) return

      if (msg.type === 'progress') {
        setProgress(msg.data.pct)
        setLabel(msg.data.label ?? '')
      } else if (msg.type === 'result') {
        currentIdRef.current = null
        setProgress(100)
        resolveRef.current?.(msg.data as TResult)
        resolveRef.current = null
        rejectRef.current = null
      } else if (msg.type === 'error') {
        currentIdRef.current = null
        setError(msg.data)
        rejectRef.current?.(new Error(msg.data))
        resolveRef.current = null
        rejectRef.current = null
      }
    }

    worker.onerror = (ev) => {
      if (!currentIdRef.current) return
      currentIdRef.current = null
      const message = ev.message || 'Worker crashed'
      setError(message)
      rejectRef.current?.(new Error(message))
      resolveRef.current = null
      rejectRef.current = null
    }

    return () => {
      worker.terminate()
      workerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const run = useCallback(
    (operation: string, payload: unknown) => {
      const worker = workerRef.current
      if (!worker) return Promise.reject(new Error('Worker not ready'))

      if (currentIdRef.current) {
        return Promise.reject(new Error('An operation is already running. Cancel it first.'))
      }

      const promise = new Promise<TResult>((resolve, reject) => {
        const id = uid('w_')
        currentIdRef.current = id
        resolveRef.current = resolve
        rejectRef.current = reject
        setRunning(true)
        setProgress(0)
        setLabel('Starting…')
        setError(null)

        const request: WorkerRequest = { id, signal: 'start', operation, payload }
        worker.postMessage(request)
      })
      // Cancellation and worker errors reject this promise; tools drive their
      // UI from hook state rather than the promise, so mark it handled here to
      // avoid noisy unhandled-rejection reports while callers awaiting it
      // still observe the rejection.
      promise.catch(() => {})
      return promise.finally(() => {
        setRunning(false)
        setTimeout(() => setProgress(null), 300)
      })
    },
    [],
  )

  const cancel = useCallback(() => {
    const id = currentIdRef.current
    if (!id || !workerRef.current) return
    workerRef.current.postMessage({ id, signal: 'cancel' } as unknown as WorkerRequest)
    // Settle the pending promise immediately so `running` flips back to false
    // and the UI unblocks. The worker suppresses any late result/error for
    // this id, and batch loops stop between items.
    currentIdRef.current = null
    const reject = rejectRef.current
    resolveRef.current = null
    rejectRef.current = null
    setProgress(null)
    setLabel('')
    if (reject) {
      const err = new Error('Cancelled')
      err.name = 'AbortError'
      reject(err)
    }
  }, [])

  const resetError = useCallback(() => setError(null), [])

  return { run, cancel, resetError, running, progress, label, error }
}
