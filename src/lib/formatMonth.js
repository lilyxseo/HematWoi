export default function formatMonth(m) {
  if (!m) return "";
  const date = new Date(`${m}-01`);
  return date.toLocaleDateString("id-ID", { month: "short", year: "numeric" });
}
