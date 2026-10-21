/**
 * A tiny unified-diff writer, with no dependency. The board only previews a
 * single ticket file, so the O(n·m) LCS table is bounded; a pathological file
 * falls back to one whole-file hunk rather than allocating without limit.
 */
type DiffOp = { type: ' ' | '-' | '+'; text: string; oldLine: number; newLine: number };

const MAX_CELLS = 4_000_000;

const diffLines = (content: string): string[] => {
  if (content === '') return [];
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
};

const lcsOps = (before: readonly string[], after: readonly string[]): DiffOp[] => {
  const m = before.length;
  const n = after.length;
  if (m === 0 && n === 0) return [];
  if (m === 0) return after.map((text, index) => ({ type: '+', text, oldLine: 0, newLine: index + 1 }));
  if (n === 0) return before.map((text, index) => ({ type: '-', text, oldLine: index + 1, newLine: 0 }));
  if (m * n > MAX_CELLS) {
    return [
      ...before.map((text, index) => ({ type: '-' as const, text, oldLine: index + 1, newLine: 0 })),
      ...after.map((text, index) => ({ type: '+' as const, text, oldLine: 0, newLine: index + 1 })),
    ];
  }

  const width = n + 1;
  const table = new Uint32Array((m + 1) * width);
  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      const at = i * width + j;
      table[at] =
        before[i] === after[j]
          ? (table[(i + 1) * width + j + 1] ?? 0) + 1
          : Math.max(table[(i + 1) * width + j] ?? 0, table[i * width + j + 1] ?? 0);
    }
  }

  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (before[i] === after[j]) {
      ops.push({ type: ' ', text: before[i] ?? '', oldLine: i + 1, newLine: j + 1 });
      i += 1;
      j += 1;
    } else if ((table[(i + 1) * width + j] ?? 0) >= (table[i * width + j + 1] ?? 0)) {
      ops.push({ type: '-', text: before[i] ?? '', oldLine: i + 1, newLine: 0 });
      i += 1;
    } else {
      ops.push({ type: '+', text: after[j] ?? '', oldLine: 0, newLine: j + 1 });
      j += 1;
    }
  }
  while (i < m) {
    ops.push({ type: '-', text: before[i] ?? '', oldLine: i + 1, newLine: 0 });
    i += 1;
  }
  while (j < n) {
    ops.push({ type: '+', text: after[j] ?? '', oldLine: 0, newLine: j + 1 });
    j += 1;
  }
  return ops;
};

type Hunk = { start: number; end: number };

const hunksFor = (ops: readonly DiffOp[], context: number): Hunk[] => {
  const hunks: Hunk[] = [];
  for (let index = 0; index < ops.length; index += 1) {
    if (ops[index]?.type === ' ') continue;
    const start = Math.max(0, index - context);
    const end = Math.min(ops.length, index + context + 1);
    const previous = hunks[hunks.length - 1];
    if (previous && start <= previous.end) previous.end = Math.max(previous.end, end);
    else hunks.push({ start, end });
  }
  return hunks;
};

const rangeLabel = (start: number, count: number): string => (count === 1 ? String(start) : `${start},${count}`);

const normalizeDiffPath = (path: string): string => path.replace(/\\/g, '/').replace(/^\.\//, '');

/**
 * Return a `git diff`-shaped unified diff. An unchanged input returns `''`;
 * the board must not show an empty confirmation dialog for a no-op write.
 */
export const buildUnifiedDiff = (path: string, before: string, after: string, context = 3): string => {
  if (before === after) return '';
  const oldLines = diffLines(before);
  const newLines = diffLines(after);
  const ops = lcsOps(oldLines, newLines);
  const hunks = hunksFor(ops, Math.max(0, context));
  if (!hunks.length) return '';
  const cleanPath = normalizeDiffPath(path);
  const header = [`diff --git a/${cleanPath} b/${cleanPath}`, `--- a/${cleanPath}`, `+++ b/${cleanPath}`];
  const body: string[] = [];
  let oldBefore = 0;
  let newBefore = 0;
  let opIndex = 0;
  for (const hunk of hunks) {
    while (opIndex < hunk.start) {
      const op = ops[opIndex];
      if (op?.type !== '+') oldBefore += 1;
      if (op?.type !== '-') newBefore += 1;
      opIndex += 1;
    }
    let oldCount = 0;
    let newCount = 0;
    for (let index = hunk.start; index < hunk.end; index += 1) {
      const op = ops[index];
      if (!op) continue;
      if (op.type !== '+') oldCount += 1;
      if (op.type !== '-') newCount += 1;
    }
    const oldStart = oldCount === 0 ? oldBefore : oldBefore + 1;
    const newStart = newCount === 0 ? newBefore : newBefore + 1;
    body.push(`@@ -${rangeLabel(oldStart, oldCount)} +${rangeLabel(newStart, newCount)} @@`);
    for (let index = hunk.start; index < hunk.end; index += 1) {
      const op = ops[index];
      if (!op) continue;
      body.push(`${op.type}${op.text}`);
    }
    for (let index = hunk.start; index < hunk.end; index += 1) {
      const op = ops[index];
      if (op?.type !== '+') oldBefore += 1;
      if (op?.type !== '-') newBefore += 1;
    }
    opIndex = hunk.end;
  }
  return [...header, ...body].join('\n');
};
