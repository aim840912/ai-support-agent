import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Returns a Date set to midnight UTC on the 1st of the current month.
 *  Using UTC methods prevents off-by-one errors when the server runs in a
 *  non-UTC timezone (e.g. serverless environments with unexpected TZ settings).
 */
export function getStartOfMonth(): Date {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
