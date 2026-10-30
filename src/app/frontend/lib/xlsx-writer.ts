/**
 * File purpose: Builds minimal Office Open XML (.xlsx) workbooks in the browser without a third-party dependency.
 * Fallback/error behavior: Empty or missing cell values are written as blank cells; text is XML-escaped, stripped of characters XML cannot hold, and truncated to Excel's cell limit.
 * Known limitation: Supports text, numbers, and dates with a fixed header/body style set; formulas, merged cells, and compression are intentionally not supported.
 */

/** A date cell stored as an Excel serial number so it sorts and filters as a date. */
export type XlsxDate = { excelSerial: number; format: 'date' | 'datetime' };
export type XlsxCell = string | number | XlsxDate | null | undefined;
export type XlsxColumn = { header: string; width?: number };
export type XlsxSheet = { name: string; columns: XlsxColumn[]; rows: XlsxCell[][]; filter?: boolean };

const EXCEL_EPOCH_OFFSET_DAYS = 25569;
const MS_PER_DAY = 86400000;
const MAX_CELL_TEXT = 32767;
const STYLE_HEADER = 1;
const STYLE_TEXT = 2;
const STYLE_DATE = 3;
const STYLE_DATETIME = 4;

/** Converts a stored calendar date (YYYY-MM-DD) to an Excel date cell without shifting it across time zones. */
export function xlsxDate(value: string | null | undefined): XlsxDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
  if (!match) return null;
  return { excelSerial: Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / MS_PER_DAY + EXCEL_EPOCH_OFFSET_DAYS, format: 'date' };
}

/** Converts a timestamp to an Excel date-time cell in the exporting user's local time, matching on-screen dates. */
export function xlsxDateTime(value: string | Date | null | undefined): XlsxDate | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return { excelSerial: (date.getTime() - date.getTimezoneOffset() * 60000) / MS_PER_DAY + EXCEL_EPOCH_OFFSET_DAYS, format: 'datetime' };
}

/** Builds the .xlsx package bytes for the given sheets. */
export function buildXlsx(sheets: XlsxSheet[]): Uint8Array<ArrayBuffer> {
  if (!sheets.length) throw new Error('A workbook needs at least one sheet.');
  const names = uniqueSheetNames(sheets.map((sheet) => sheet.name));
  const files: Array<{ path: string; content: string }> = [
    { path: '[Content_Types].xml', content: contentTypesXml(sheets.length) },
    { path: '_rels/.rels', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { path: 'xl/workbook.xml', content: workbookXml(sheets, names) },
    { path: 'xl/_rels/workbook.xml.rels', content: workbookRelsXml(sheets.length) },
    { path: 'xl/styles.xml', content: STYLES_XML },
    ...sheets.map((sheet, index) => ({ path: `xl/worksheets/sheet${index + 1}.xml`, content: worksheetXml(sheet) })),
  ];
  const encoder = new TextEncoder();
  return zipStored(files.map((file) => ({ path: file.path, data: encoder.encode(file.content) })));
}

/** Downloads workbook bytes as an .xlsx file. */
export function downloadXlsx(bytes: Uint8Array<ArrayBuffer>, fileName: string) {
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Returns the spreadsheet column letters for a zero-based column index (0 → A, 26 → AA). */
export function columnLetters(index: number) {
  let letters = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
  return letters;
}

function uniqueSheetNames(names: string[]) {
  const used = new Set<string>();
  return names.map((name, index) => {
    const base = (name.replace(/[[\]:*?/\\]/g, ' ').trim() || `Sheet${index + 1}`).slice(0, 31);
    let candidate = base;
    for (let suffix = 2; used.has(candidate.toLowerCase()); suffix += 1) candidate = `${base.slice(0, 31 - String(suffix).length - 1)} ${suffix}`;
    used.add(candidate.toLowerCase());
    return candidate;
  });
}

function escapeXml(value: string) {
  return value
    .replace(/[^\x09\x0A\x0D\x20-퟿-�\u{10000}-\u{10FFFF}]/gu, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cellXml(value: XlsxCell, ref: string, style: number) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number') return Number.isFinite(value) ? `<c r="${ref}" s="${style}"><v>${value}</v></c>` : '';
  if (typeof value === 'object') return `<c r="${ref}" s="${value.format === 'date' ? STYLE_DATE : STYLE_DATETIME}"><v>${value.excelSerial}</v></c>`;
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value.slice(0, MAX_CELL_TEXT))}</t></is></c>`;
}

function worksheetXml(sheet: XlsxSheet) {
  const columnCount = Math.max(1, sheet.columns.length);
  const lastRef = `${columnLetters(columnCount - 1)}${sheet.rows.length + 1}`;
  const cols = sheet.columns.map((column, index) => `<col min="${index + 1}" max="${index + 1}" width="${column.width ?? 18}" customWidth="1"/>`).join('');
  const header = `<row r="1">${sheet.columns.map((column, index) => cellXml(column.header, `${columnLetters(index)}1`, STYLE_HEADER)).join('')}</row>`;
  const body = sheet.rows.map((row, rowIndex) => `<row r="${rowIndex + 2}">${row.slice(0, columnCount).map((value, index) => cellXml(value, `${columnLetters(index)}${rowIndex + 2}`, STYLE_TEXT)).join('')}</row>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="A1:${lastRef}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>${cols ? `<cols>${cols}</cols>` : ''}<sheetData>${header}${body}</sheetData>${sheet.filter === false ? '' : `<autoFilter ref="A1:${lastRef}"/>`}</worksheet>`;
}

function workbookXml(sheets: XlsxSheet[], names: string[]) {
  const sheetEntries = names.map((name, index) => `<sheet name="${escapeXml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('');
  const filters = sheets.map((sheet, index) => sheet.filter === false ? '' : `<definedName name="_xlnm._FilterDatabase" localSheetId="${index}" hidden="1">'${escapeXml(names[index].replace(/'/g, "''"))}'!$A$1:$${columnLetters(Math.max(1, sheet.columns.length) - 1)}$${sheet.rows.length + 1}</definedName>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${sheetEntries}</sheets>${filters ? `<definedNames>${filters}</definedNames>` : ''}</workbook>`;
}

function workbookRelsXml(sheetCount: number) {
  const sheets = Array.from({ length: sheetCount }, (_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets}<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
}

function contentTypesXml(sheetCount: number) {
  const sheets = Array.from({ length: sheetCount }, (_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets}</Types>`;
}

// Style indexes: 0 default, 1 bold shaded header, 2 wrapped top-aligned body, 3 date, 4 date-time.
const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/><numFmt numFmtId="165" formatCode="yyyy-mm-dd hh:mm"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE2E8F0"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/** Computes the CRC-32 checksum ZIP requires for each entry. */
export function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Packages files into an uncompressed (stored) ZIP archive, which is a valid .xlsx container. */
function zipStored(entries: Array<{ path: string; data: Uint8Array }>): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.path);
    const crc = crc32(entry.data);
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true); lv.setUint16(8, 0, true);
    lv.setUint16(10, dosTime, true); lv.setUint16(12, dosDate, true); lv.setUint32(14, crc, true);
    lv.setUint32(18, entry.data.length, true); lv.setUint32(22, entry.data.length, true); lv.setUint16(26, name.length, true); lv.setUint16(28, 0, true);
    local.set(name, 30);
    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true); cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true); cv.setUint16(14, dosDate, true); cv.setUint32(16, crc, true);
    cv.setUint32(20, entry.data.length, true); cv.setUint32(24, entry.data.length, true); cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);
    localParts.push(local, entry.data);
    centralParts.push(central);
    offset += local.length + entry.data.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, entries.length, true); ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true); ev.setUint32(16, offset, true);
  const output = new Uint8Array(offset + centralSize + end.length);
  let position = 0;
  for (const part of [...localParts, ...centralParts, end]) { output.set(part, position); position += part.length; }
  return output;
}
