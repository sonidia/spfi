export function fmtDate(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function capitalize(s: string) {
  if (!s) return "";
  return String(s).charAt(0).toUpperCase() + String(s).slice(1).replace(/_/g, " ");
}
