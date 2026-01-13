export type CsvColumn<T> = {
  key: keyof T;
  header: string;
  value?: (row: T) => string | number | null | undefined;
};

export function escapeCsv(value: string | number | null | undefined) {
  const raw = value == null ? '' : String(value);
  const escaped = raw.replace(/"/g, '""');
  if (/[",\n\r]/.test(escaped)) {
    return `"${escaped}"`;
  }
  return escaped;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]) {
  const header = columns.map((col) => escapeCsv(col.header)).join(',');
  const lines = rows.map((row) =>
    columns
      .map((col) => {
        const value = col.value ? col.value(row) : (row[col.key] as any);
        return escapeCsv(value as any);
      })
      .join(',')
  );
  return [header, ...lines].join('\n');
}

export function downloadCsv(filename: string, csvStringWithBom: string) {
  const blob = new Blob([csvStringWithBom], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
