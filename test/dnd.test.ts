import { test } from 'node:test';
import assert from 'node:assert/strict';
import { insertionTarget } from '../src/ui/dnd.ts';

test('insertionTarget picks the card whose midpoint the pointer has not reached', () => {
  const cards = [
    { id: 'a', top: 0, height: 40 },
    { id: 'b', top: 40, height: 40 },
    { id: 'c', top: 80, height: 40 },
  ];
  assert.equal(insertionTarget(cards, 5), 'a');
  assert.equal(insertionTarget(cards, 19), 'a');
  assert.equal(insertionTarget(cards, 21), 'b');
  assert.equal(insertionTarget(cards, 65), 'c');
  assert.equal(insertionTarget(cards, 200), null);
});

test('insertionTarget on an empty column always drops at the end', () => {
  assert.equal(insertionTarget([], 0), null);
});
