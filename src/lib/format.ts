/**
 * Formatting shared by server and client code. Kept free of database imports so
 * a Client Component can call it: passing a formatter down as a prop is not
 * allowed across that boundary.
 */
export function formatHours(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}
