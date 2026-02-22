export function parseCsv(raw: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  const pushCell = () => {
    row.push(cell);
    cell = "";
  };

  const pushRow = () => {
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i];
    const next = raw[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
        continue;
      }
      if (char === '"') {
        inQuotes = false;
        continue;
      }
      cell += char;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      pushCell();
      continue;
    }
    if (char === "\n") {
      pushCell();
      pushRow();
      continue;
    }
    if (char === "\r") {
      continue;
    }
    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    pushCell();
    pushRow();
  }

  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0].trim().length > 0));
}

export function toCsv(rows: Array<Record<string, unknown>>, headers?: string[]): string {
  if (!rows.length) {
    return "";
  }

  const cols = headers ?? Object.keys(rows[0]);
  const escape = (value: unknown): string => {
    if (value === null || value === undefined) {
      return "";
    }
    const str = String(value);
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [cols.join(",")];
  for (const row of rows) {
    lines.push(cols.map((col) => escape(row[col])).join(","));
  }
  return `${lines.join("\n")}\n`;
}
