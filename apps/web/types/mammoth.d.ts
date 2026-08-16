declare module 'mammoth' {
  export interface MammothResult {
    value: string
    messages: Array<{ type: string; message: string }>
  }

  export interface Input {
    arrayBuffer?: ArrayBuffer
    path?: string
  }

  export function extractRawText(input: Input): Promise<MammothResult>
  export function convertToHtml(input: Input): Promise<MammothResult>
  export function extractSnippets(input: Input): Promise<MammothResult>
}
