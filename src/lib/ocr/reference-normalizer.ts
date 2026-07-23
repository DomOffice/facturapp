export function normalizeReference(reference?: string | null): string | null {
  if (!reference) return null;

  return reference
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");
}