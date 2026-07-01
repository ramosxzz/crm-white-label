function canonical(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function normalizeInboundContactName(
  name: string | null | undefined,
  ignoredNames: Array<string | null | undefined> = [],
) {
  const trimmed = name?.trim();
  if (!trimmed) return null;

  const normalized = canonical(trimmed);
  if (!normalized) return null;
  if (/^lead\d{10,}$/.test(normalized)) return null;
  if (/^\d{8,}$/.test(normalized)) return null;

  const ignored = ignoredNames
    .map((value) => (value ? canonical(value) : ""))
    .filter(Boolean);

  if (ignored.some((value) => normalized === value)) return null;

  return trimmed;
}
