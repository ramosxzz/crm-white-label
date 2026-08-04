export type SpreadsheetRow = Record<string, string>;

function makeUniqueHeaders(rawHeaders: unknown[]): string[] {
  const seen = new Map<string, number>();
  return rawHeaders.map((value, index) => {
    const base = String(value ?? "").trim() || `Coluna ${index + 1}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base} (${count + 1})`;
  });
}

/** Le a primeira aba de XLS/XLSX. O modulo pesado so e baixado pelo browser
 * quando o usuario realmente seleciona um arquivo do Excel. */
export async function parseExcelBuffer(
  buffer: ArrayBuffer,
): Promise<{ headers: string[]; rows: SpreadsheetRow[] }> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { cellDates: false });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error("A planilha nao possui nenhuma aba.");

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[firstSheetName], {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false,
  });
  const headerIndex = matrix.findIndex((row) => row.some((cell) => String(cell ?? "").trim()));
  if (headerIndex < 0) throw new Error("A planilha esta vazia.");

  const lastColumn = matrix[headerIndex].reduce<number>(
    (last, cell, index) => (String(cell ?? "").trim() ? index : last),
    -1,
  );
  const headers = makeUniqueHeaders(matrix[headerIndex].slice(0, lastColumn + 1));
  const rows = matrix
    .slice(headerIndex + 1)
    .map((values) =>
      Object.fromEntries(headers.map((header, index) => [header, String(values[index] ?? "").trim()])),
    )
    .filter((row) => Object.values(row).some(Boolean));

  return { headers, rows };
}
