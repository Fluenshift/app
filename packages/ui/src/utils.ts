import { clsx } from "clsx";
import type { ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Joins class names and resolves conflicting Tailwind utilities, as shadcn components expect. */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
