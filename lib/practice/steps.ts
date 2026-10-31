// The generators' step reveal (common.py JS), as pure functions. `shown` counts revealed steps;
// shown > total means the result is revealed too.

/** After "Krok N": one more step; revealing the last step also reveals the result. */
export function revealNext(shown: number, total: number): number {
  const value = Math.min(shown + 1, total + 1)
  return value === total ? total + 1 : value
}

export function isFinished(shown: number, total: number): boolean {
  return shown > total
}

/** Label of the step button: "Krok N", "Výsledek" (an example without steps) or "Hotovo". */
export function stepButtonLabel(shown: number, total: number): string {
  if (isFinished(shown, total)) return "Hotovo"
  return shown < total ? `Krok ${shown + 1}` : "Výsledek"
}
