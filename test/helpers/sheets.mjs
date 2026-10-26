// Reads the seed CSVs in sheets/ the way the n8n Sheets node hands rows over:
// one object per row keyed by the header. Values stay strings.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SHEETS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'sheets');

function parseCsvLine(line) {
  const cells = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { cells.push(cell); cell = ''; }
    else cell += ch;
  }
  cells.push(cell);
  return cells;
}

export function readSheet(tab) {
  const lines = readFileSync(join(SHEETS, `${tab}.csv`), 'utf8').split(/\r?\n/).filter(l => l.length);
  const header = parseCsvLine(lines[0]);
  return lines.slice(1).map(line => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(header.map((h, i) => [h, cells[i] ?? '']));
  });
}
