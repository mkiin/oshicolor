import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** File → Base64 文字列 */
export const fileToBase64 = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const binary = bytes.reduce((s, b) => s + String.fromCharCode(b), "");
  return btoa(binary);
};

/** File → MIME type（フォールバック: image/png） */
export const fileMimeType = (file: File): string => file.type || "image/png";
