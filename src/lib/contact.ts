// Lenient "email or phone" check for the booking contact field. Deliberately
// permissive — the goal is to block obvious garbage ("asdf") that would create a
// dead lead the clinic can't reach, NOT to reject real contacts and cost a
// conversion. Shared by the client form and the server lead schema.
export function isValidContact(raw: string): boolean {
  const s = raw.trim();
  // Email: x@y.z (no spaces). Good enough — the clinic confirms by replying.
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return true;
  // Phone: 7–15 digits once separators (spaces, dashes, parens, +) are stripped.
  const digits = s.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}
