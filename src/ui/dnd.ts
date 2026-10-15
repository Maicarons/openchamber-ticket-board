export type CardRect = { id: string; top: number; height: number };

/**
 * Pure drop-target logic for a vertical column: given the cards' current
 * screen rects (top-to-bottom order) and the pointer's Y position, returns
 * the id of the card the dragged item should land before, or `null` to drop
 * at the end of the column. Kept separate from the DOM so it is unit-testable.
 */
export const insertionTarget = (cards: readonly CardRect[], pointerY: number): string | null => {
  for (const card of cards) {
    if (pointerY < card.top + card.height / 2) return card.id;
  }
  return null;
};
