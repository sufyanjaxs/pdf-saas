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
  FileText,
  FileSpreadsheet,
  Presentation,
  FileOutput,
  Lock,
  Unlock,
  Stamp,
  ListOrdered,
  Frame,
  Shuffle,
  Type,
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
  | 'file-text'
  | 'file-spreadsheet'
  | 'presentation'
  | 'file-output'
  | 'lock'
  | 'unlock'
  | 'stamp'
  | 'list-ordered'
  | 'frame'
  | 'shuffle'
  | 'type'

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
  'file-text': FileText,
  'file-spreadsheet': FileSpreadsheet,
  presentation: Presentation,
  'file-output': FileOutput,
  lock: Lock,
  unlock: Unlock,
  stamp: Stamp,
  'list-ordered': ListOrdered,
  frame: Frame,
  shuffle: Shuffle,
  type: Type,
}

export function ToolIcon({ name, className }: { name: ToolIconName; className?: string }) {
  const Icon = icons[name]
  return <Icon className={className} />
}
