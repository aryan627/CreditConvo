import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cname(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
