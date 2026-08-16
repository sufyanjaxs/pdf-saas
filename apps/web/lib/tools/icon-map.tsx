import {
  FileStack,
  FilePlus2,
  Trash2,
  Scissors,
  RotateCw,
  Images,
  FileImage,
  Archive,
  ImageDown,
  Ruler,
  Crop,
  Repeat,
  type LucideIcon,
} from 'lucide-react'

export type ToolIconName =
  | 'file-split'
  | 'file-merge'
  | 'trash'
  | 'scissors'
  | 'rotate'
  | 'image-to-pdf'
  | 'pdf-to-image'
  | 'archive'
  | 'image-compress'
  | 'ruler'
  | 'crop'
  | 'refresh'

const icons: Record<ToolIconName, LucideIcon> = {
  'file-split': FileStack,
  'file-merge': FilePlus2,
  trash: Trash2,
  scissors: Scissors,
  rotate: RotateCw,
  'image-to-pdf': Images,
  'pdf-to-image': FileImage,
  archive: Archive,
  'image-compress': ImageDown,
  ruler: Ruler,
  crop: Crop,
  refresh: Repeat,
}

export function ToolIcon({ name, className }: { name: ToolIconName; className?: string }) {
  const Icon = icons[name]
  return <Icon className={className} />
}
