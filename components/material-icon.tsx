import { FileArchive, FileText, Link2 } from "lucide-react"
import { MATERIAL_TYPES, getMaterialType } from "@/lib/constants"
import { cn } from "@/lib/utils"

const SIZE_CLASSES = { sm: "h-4 w-4", md: "h-8 w-8", lg: "h-12 w-12" } as const

const EXTENSION_COLORS: Record<string, string> = {
  pdf: "text-red-600 dark:text-red-400",
  doc: "text-primary",
  docx: "text-primary",
  xls: "text-green-600 dark:text-green-400",
  xlsx: "text-green-600 dark:text-green-400",
  ppt: "text-orange-600 dark:text-orange-400",
  pptx: "text-orange-600 dark:text-orange-400",
  zip: "text-amber-600 dark:text-amber-400",
}

interface MaterialIconProps {
  material: { material_type?: string | null; file_extension?: string | null }
  size?: keyof typeof SIZE_CLASSES
}

export function MaterialIcon({ material, size = "sm" }: MaterialIconProps) {
  const sizeClass = SIZE_CLASSES[size]

  if (getMaterialType(material) === MATERIAL_TYPES.LINK) {
    return <Link2 className={cn(sizeClass, "text-primary-600 dark:text-primary-400")} />
  }

  const ext = material.file_extension?.toLowerCase().replace(".", "") || ""
  const Icon = ext === "zip" ? FileArchive : FileText
  return <Icon className={cn(sizeClass, EXTENSION_COLORS[ext] || "text-muted-foreground")} />
}
