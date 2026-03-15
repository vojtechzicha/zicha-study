import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDateCzech(date: string | Date | null | undefined): string {
  if (!date) return ""
  
  const dateObj = typeof date === "string" ? new Date(date) : date
  if (isNaN(dateObj.getTime())) return ""
  
  return dateObj.toLocaleDateString("cs-CZ")
}
