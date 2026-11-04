export function findNextUnsentStreet(
  orderedStreets: readonly string[],
  completedStreet: string,
  availableStreets: readonly string[]
): string | null {
  const completedIndex = orderedStreets.findIndex(
    (street) => street.trim().toLocaleLowerCase() === completedStreet.trim().toLocaleLowerCase()
  );
  if (completedIndex < 0 || orderedStreets.length < 2) return null;

  const available = new Set(availableStreets.map((street) => street.trim().toLocaleLowerCase()));
  for (let offset = 1; offset < orderedStreets.length; offset++) {
    const candidate = orderedStreets[(completedIndex + offset) % orderedStreets.length];
    if (available.has(candidate.trim().toLocaleLowerCase())) return candidate;
  }

  return null;
}
