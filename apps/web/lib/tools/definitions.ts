import type { ToolMeta, ToolCategory } from '@pdf-saas/shared'

export interface ToolDefinition extends ToolMeta {
  icon: 'file-split' | 'file-merge' | 'trash' | 'scissors' | 'rotate' | 'image-to-pdf' | 'pdf-to-image' | 'archive' | 'image-compress' | 'ruler' | 'crop' | 'refresh'
}

const def = (
  slug: string,
  name: string,
  shortName: string,
  category: ToolCategory,
  description: string,
  icon: ToolDefinition['icon'],
  keywords: string[],
): ToolDefinition => ({ slug, name, shortName, category, description, icon, keywords })

export const toolDefinitions: ToolDefinition[] = [
  def(
    'pdf-splitter',
    'Split PDF',
    'Split',
    'PDF',
    'Pick the exact pages you want and download them as a brand-new PDF.',
    'file-split',
    ['split pdf', 'extract pages pdf', 'remove pages pdf', 'pdf page splitter'],
  ),
  def(
    'pdf-merger',
    'Merge PDFs',
    'Merge',
    'PDF',
    'Combine multiple PDF files into a single document in the order you choose.',
    'file-merge',
    ['merge pdf', 'combine pdf', 'join pdf files', 'pdf merger'],
  ),
  def(
    'pdf-delete-pages',
    'Delete PDF Pages',
    'Delete',
    'PDF',
    'Remove unwanted pages from a PDF with a visual thumbnail picker.',
    'trash',
    ['delete pages pdf', 'remove pages from pdf', 'pdf page deleter'],
  ),
  def(
    'pdf-extractor',
    'Extract PDF Pages',
    'Extract',
    'PDF',
    'Pull out specific pages using simple ranges like 2, 5, 7-10.',
    'scissors',
    ['extract pages pdf', 'pdf page extractor', 'save selected pages pdf'],
  ),
  def(
    'pdf-rotator',
    'Rotate PDF',
    'Rotate',
    'PDF',
    'Rotate pages 90, 180 or 270 degrees — one page or the whole document.',
    'rotate',
    ['rotate pdf', 'rotate pages pdf', 'pdf rotate 90 degrees'],
  ),
  def(
    'jpg-to-pdf',
    'JPG to PDF',
    'JPG→PDF',
    'PDF',
    'Turn images (JPG, PNG, WEBP) into a single PDF, reorder before exporting.',
    'image-to-pdf',
    ['jpg to pdf', 'image to pdf', 'png to pdf', 'create pdf from images'],
  ),
  def(
    'pdf-to-jpg',
    'PDF to JPG',
    'PDF→JPG',
    'PDF',
    'Export PDF pages as high-quality JPG images.',
    'pdf-to-image',
    ['pdf to jpg', 'pdf to image', 'convert pdf pages to images'],
  ),
  def(
    'pdf-compressor',
    'Compress PDF',
    'Compress',
    'PDF',
    'Shrink PDF file size with balanced, strong or maximum compression.',
    'archive',
    ['compress pdf', 'reduce pdf size', 'smaller pdf', 'pdf compressor'],
  ),
  def(
    'image-compressor',
    'Image Compressor',
    'Compress',
    'Image',
    'Reduce the file size of JPG, PNG and WEBP images with quality control.',
    'image-compress',
    ['compress image', 'reduce image size', 'image file size', 'optimize image'],
  ),
  def(
    'image-resizer',
    'Image Resizer',
    'Resize',
    'Image',
    'Resize images to exact dimensions while keeping quality and aspect ratio.',
    'ruler',
    ['resize image', 'image dimensions', 'resize photo', 'scale image'],
  ),
  def(
    'image-cropper',
    'Image Cropper',
    'Crop',
    'Image',
    'Crop images visually with a draggable selection rectangle.',
    'crop',
    ['crop image', 'crop photo', 'crop picture', 'image crop tool'],
  ),
  def(
    'image-converter',
    'Image Converter',
    'Convert',
    'Image',
    'Convert between JPG, PNG and WEBP formats with batch support.',
    'refresh',
    ['convert image', 'jpg to png', 'png to jpg', 'webp converter'],
  ),
]

export const pdfTools = toolDefinitions.filter((t) => t.category === 'PDF')
export const imageTools = toolDefinitions.filter((t) => t.category === 'Image')

export function getTool(slug: string): ToolDefinition | undefined {
  return toolDefinitions.find((t) => t.slug === slug)
}
