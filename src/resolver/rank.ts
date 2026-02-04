export interface RankedHint {
  message: string;
}

export function rankAmbiguousCandidates(candidates: unknown[]): RankedHint[] {
  if (candidates.length <= 1) {
    return [];
  }
  return [
    { message: "Add `.nth(1)` or `.nth(2)` to pick a specific match." },
    { message: "Scope the selector with `under(heading(\"X\"))`." },
  ];
}
