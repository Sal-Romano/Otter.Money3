/**
 * CSV parsing and generation utilities
 * RFC 4180 compliant
 */

/**
 * Escape a value for CSV output
 * Wraps in quotes if it contains commas, quotes, or newlines
 */
export function escapeCSV(value: string | null | undefined): string {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/**
 * Build a CSV row from an array of values
 */
export function csvRow(values: (string | number | boolean | null | undefined)[]): string {
  return values.map((v) => {
    if (v == null) return '';
    if (typeof v === 'number') return String(v);
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    return escapeCSV(v);
  }).join(',');
}

/**
 * Parse a CSV string into headers and rows
 * Handles quoted fields, escaped quotes, and newlines within quotes
 */
export function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = parseCSVLines(text);
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = lines[0].map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Skip empty rows
    if (line.length === 1 && line[0].trim() === '') continue;

    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = (line[j] || '').trim();
    }
    rows.push(row);
  }

  return { headers, rows };
}

/**
 * Parse CSV text into an array of arrays (each inner array = one row of fields)
 */
function parseCSVLines(text: string): string[][] {
  const results: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        // Check for escaped quote
        if (i + 1 < text.length && text[i + 1] === '"') {
          currentField += '"';
          i += 2;
        } else {
          // End of quoted field
          inQuotes = false;
          i++;
        }
      } else {
        currentField += char;
        i++;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
        i++;
      } else if (char === '\r') {
        // Handle \r\n or standalone \r
        currentRow.push(currentField);
        currentField = '';
        results.push(currentRow);
        currentRow = [];
        i++;
        if (i < text.length && text[i] === '\n') {
          i++;
        }
      } else if (char === '\n') {
        currentRow.push(currentField);
        currentField = '';
        results.push(currentRow);
        currentRow = [];
        i++;
      } else {
        currentField += char;
        i++;
      }
    }
  }

  // Handle last field/row
  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField);
    results.push(currentRow);
  }

  return results;
}

/**
 * Normalize a CSV column header to a known field name
 */
export function normalizeColumnName(header: string): string {
  const normalized = header.toLowerCase().replace(/[^a-z0-9]/g, '');

  const mappings: Record<string, string> = {
    // Standard Otter Money columns
    'id': 'id',
    'externalid': 'externalId',
    'date': 'date',
    'amount': 'amount',
    'type': 'type',
    'description': 'description',
    'merchant': 'merchant',
    'merchantname': 'merchant',
    'category': 'category',
    'account': 'account',
    'accountname': 'account',
    'owner': 'owner',
    'notes': 'notes',
    'note': 'notes',
    'memo': 'notes',
    'ismanual': 'isManual',
    'manual': 'isManual',
  };

  return mappings[normalized] || header;
}

/**
 * Parse a date string in various formats
 * Returns a Date or null if unparseable
 */
export function parseDate(value: string): Date | null {
  if (!value || !value.trim()) return null;

  const trimmed = value.trim();

  // YYYY-MM-DD (ISO)
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const d = new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
    if (!isNaN(d.getTime())) return d;
  }

  // MM/DD/YYYY or M/D/YYYY
  const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    const d = new Date(parseInt(usMatch[3]), parseInt(usMatch[1]) - 1, parseInt(usMatch[2]));
    if (!isNaN(d.getTime())) return d;
  }

  // MM-DD-YYYY
  const usDashMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (usDashMatch) {
    const d = new Date(parseInt(usDashMatch[3]), parseInt(usDashMatch[1]) - 1, parseInt(usDashMatch[2]));
    if (!isNaN(d.getTime())) return d;
  }

  // Fallback: try native Date parsing
  const fallback = new Date(trimmed);
  if (!isNaN(fallback.getTime())) return fallback;

  return null;
}

/**
 * Parse an amount string, handling currency symbols and commas
 */
export function parseAmount(value: string): number | null {
  if (!value || !value.trim()) return null;

  // Remove currency symbols, spaces, and commas
  const cleaned = value.trim().replace(/[$€£¥,\s]/g, '');

  // Handle parentheses as negative (accounting format)
  const parenMatch = cleaned.match(/^\((.+)\)$/);
  if (parenMatch) {
    const num = parseFloat(parenMatch[1]);
    return isNaN(num) ? null : -num;
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Determine the sign of an amount based on a "Type" column value
 */
export function resolveAmountSign(amount: number, type: string | undefined): number {
  if (!type) return amount;

  const normalized = type.toLowerCase().trim();
  if (['expense', 'debit', 'withdrawal'].includes(normalized)) {
    return amount > 0 ? -amount : amount;
  }
  if (['income', 'credit', 'deposit'].includes(normalized)) {
    return amount < 0 ? -amount : amount;
  }
  return amount;
}
