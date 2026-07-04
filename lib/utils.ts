export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

const rupiah = new Intl.NumberFormat("id-ID");

export function formatKeping(n: number): string {
  return `Rp ${rupiah.format(n)}`;
}
