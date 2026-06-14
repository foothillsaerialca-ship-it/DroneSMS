import { supabase } from '@frontend/lib/supabase';
import {
  getOrganizationLogoUrl,
  loadOrganizationSettingsById,
  type OrganizationSettings,
} from '@frontend/features/settings/lib/organization-settings';
import {
  getSelectedHazardName,
  normalizeSelectedHazards,
} from '@frontend/features/safety/lib/preliminary-hazard-library';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 54;
const NAVY = '#0E1622';
const BLUE = '#2D6FD2';
const LIGHT_BLUE = '#EAF1FB';
const SOFT_PANEL = '#F8FAFD';
const GRAY = '#5B6470';
const LIGHT_GRAY = '#D9DEE5';
const ZEBRA = '#F4F7FB';
const WHITE = '#FFFFFF';
const PLACEHOLDER = 'To be confirmed during planning.';
const PANEL_OPACITY = 0.72;
const TABLE_ROW_OPACITY = 0.34;
const TOTAL_ROW_OPACITY = 0.48;
const WATERMARK_OPACITY = 0.03;

export type ProposalDocumentKind = 'proposal' | 'operational-packet';

export const documentTypes: Record<ProposalDocumentKind, { label: string; implemented: boolean }> = {
  proposal: { label: 'Proposal PDF', implemented: true },
  'operational-packet': { label: 'Operational Packet PDF', implemented: false },
};

type ProposalPdfRecord = {
  id: string;
  organization_id: string;
  user_id: string;
  proposal_number: string | null;
  proposal_name: string | null;
  client_name: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  service_type: string | null;
  site_address: string | null;
  description: string | null;
  proposed_rpic: string | null;
  proposed_crew: string | null;
  proposed_aircraft: string | null;
  proposed_rpic_name: string | null;
  proposed_rpic_credentials: string | null;
  proposed_rpic_bio: string | null;
  airspace_class: string | null;
  laanc_required: boolean | null;
  additional_authorization_required: boolean | null;
  hazard: string | null;
  proposed_mitigation: string | null;
  hazard_assessment: unknown;
  proposal_equipment: unknown;
  proposal_amount: number | string | null;
  valid_until: string | null;
  created_at: string | null;
};

type ProposalEquipmentAssignment = {
  equipment_id: string;
  equipment_name: string;
  equipment_type: string;
  make: string | null;
  model: string | null;
  purpose: string;
};

type PdfImage = { bytes: Uint8Array; width: number; height: number };
type TableColumn = { header: string; width: number; align?: 'left' | 'right' | 'center' };
type TableCell = string | number | null | undefined;
type TableOptions = { totalRowIndex?: number; minRowHeight?: number };
type PageState = { commands: string[]; contentId: number; pageId: number };

class PdfBuilder {
  private readonly objects: string[] = [];
  private readonly pages: PageState[] = [];
  private readonly catalogId: number;
  private readonly pagesId: number;
  private readonly fontRegularId: number;
  private readonly fontBoldId: number;
  private readonly fontObliqueId: number;
  private readonly watermarkStateId: number;
  private readonly panelStateId: number;
  private logoImageId: number | null = null;
  private logo: PdfImage | null = null;

  constructor(logo: PdfImage | null) {
    this.catalogId = this.addObject('');
    this.pagesId = this.addObject('');
    this.fontRegularId = this.addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    this.fontBoldId = this.addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    this.fontObliqueId = this.addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>');
    this.watermarkStateId = this.addObject(`<< /Type /ExtGState /ca ${WATERMARK_OPACITY} /CA ${WATERMARK_OPACITY} >>`);
    this.panelStateId = this.addObject(`<< /Type /ExtGState /ca ${PANEL_OPACITY} /CA ${PANEL_OPACITY} >>`);

    if (logo) {
      this.logo = logo;
      this.logoImageId = this.addStream(
        logo.bytes,
        `<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /DCTDecode] /Length ${logo.bytes.length * 2 + 1} >>`,
      );
    }
  }

  addPage() {
    const contentId = this.addObject('');
    const pageId = this.addObject('');
    const page = { commands: [], contentId, pageId };
    this.pages.push(page);
    return page;
  }

  getLogo() {
    return this.logo;
  }

  drawText(page: PageState, text: string, x: number, y: number, options: { size?: number; color?: string; font?: 'regular' | 'bold' | 'oblique'; align?: 'left' | 'right' | 'center' } = {}) {
    const size = options.size ?? 10;
    const fontName = options.font === 'bold' ? 'F2' : options.font === 'oblique' ? 'F3' : 'F1';
    const color = hexToRgb(options.color ?? NAVY);
    const cleanText = toPdfText(text);
    const textWidth = measureText(cleanText, size);
    const drawX = options.align === 'right' ? x - textWidth : options.align === 'center' ? x - textWidth / 2 : x;
    page.commands.push(`BT /${fontName} ${formatNumber(size)} Tf ${formatNumber(color.r)} ${formatNumber(color.g)} ${formatNumber(color.b)} rg ${formatNumber(drawX)} ${formatNumber(y)} Td <${pdfTextHex(cleanText)}> Tj ET`);
  }

  drawWrappedText(page: PageState, text: string, x: number, y: number, maxWidth: number, options: { size?: number; color?: string; font?: 'regular' | 'bold' | 'oblique'; lineHeight?: number; align?: 'left' | 'right' | 'center' } = {}) {
    const size = options.size ?? 10;
    const lineHeight = options.lineHeight ?? size + 4;
    const lines = wrapText(text, maxWidth, size);
    const textX = options.align === 'center' ? x + maxWidth / 2 : options.align === 'right' ? x + maxWidth : x;
    lines.forEach((line, index) => this.drawText(page, line, textX, y - index * lineHeight, options));
    return y - lines.length * lineHeight;
  }

  drawLine(page: PageState, x1: number, y1: number, x2: number, y2: number, color = BLUE, width = 1) {
    const rgb = hexToRgb(color);
    page.commands.push(`${formatNumber(rgb.r)} ${formatNumber(rgb.g)} ${formatNumber(rgb.b)} RG ${formatNumber(width)} w ${formatNumber(x1)} ${formatNumber(y1)} m ${formatNumber(x2)} ${formatNumber(y2)} l S`);
  }

  drawRect(page: PageState, x: number, y: number, width: number, height: number, options: { fill?: string; stroke?: string; strokeWidth?: number; opacity?: number } = {}) {
    const segments: string[] = [];
    if (options.opacity !== undefined && options.opacity < 1) segments.push('q /GS2 gs');
    if (options.fill) {
      const fill = hexToRgb(options.fill);
      segments.push(`${formatNumber(fill.r)} ${formatNumber(fill.g)} ${formatNumber(fill.b)} rg`);
    }
    if (options.stroke) {
      const stroke = hexToRgb(options.stroke);
      segments.push(`${formatNumber(stroke.r)} ${formatNumber(stroke.g)} ${formatNumber(stroke.b)} RG ${formatNumber(options.strokeWidth ?? 0.5)} w`);
    }
    segments.push(`${formatNumber(x)} ${formatNumber(y)} ${formatNumber(width)} ${formatNumber(height)} re`);
    segments.push(options.fill && options.stroke ? 'B' : options.fill ? 'f' : 'S');
    if (options.opacity !== undefined && options.opacity < 1) segments.push('Q');
    page.commands.push(segments.join(' '));
  }

  drawImage(page: PageState, x: number, y: number, width: number, height: number, opacity = 1) {
    if (!this.logoImageId) return;
    page.commands.push('q');
    if (opacity < 1) page.commands.push('/GS1 gs');
    page.commands.push(`${formatNumber(width)} 0 0 ${formatNumber(height)} ${formatNumber(x)} ${formatNumber(y)} cm /Logo Do`);
    page.commands.push('Q');
  }

  drawCircularImage(page: PageState, centerX: number, centerY: number, diameter: number, opacity = 1) {
    const logo = this.logo;
    if (!this.logoImageId || !logo) return;
    const radius = diameter / 2;
    const kappa = 0.5522847498;
    const imageRatio = logo.width / logo.height;
    const drawWidth = imageRatio >= 1 ? diameter * imageRatio : diameter;
    const drawHeight = imageRatio >= 1 ? diameter : diameter / imageRatio;
    const drawX = centerX - drawWidth / 2;
    const drawY = centerY - drawHeight / 2;

    page.commands.push('q');
    if (opacity < 1) page.commands.push('/GS1 gs');
    page.commands.push(`${formatNumber(centerX)} ${formatNumber(centerY + radius)} m`);
    page.commands.push(`${formatNumber(centerX + radius * kappa)} ${formatNumber(centerY + radius)} ${formatNumber(centerX + radius)} ${formatNumber(centerY + radius * kappa)} ${formatNumber(centerX + radius)} ${formatNumber(centerY)} c`);
    page.commands.push(`${formatNumber(centerX + radius)} ${formatNumber(centerY - radius * kappa)} ${formatNumber(centerX + radius * kappa)} ${formatNumber(centerY - radius)} ${formatNumber(centerX)} ${formatNumber(centerY - radius)} c`);
    page.commands.push(`${formatNumber(centerX - radius * kappa)} ${formatNumber(centerY - radius)} ${formatNumber(centerX - radius)} ${formatNumber(centerY - radius * kappa)} ${formatNumber(centerX - radius)} ${formatNumber(centerY)} c`);
    page.commands.push(`${formatNumber(centerX - radius)} ${formatNumber(centerY + radius * kappa)} ${formatNumber(centerX - radius * kappa)} ${formatNumber(centerY + radius)} ${formatNumber(centerX)} ${formatNumber(centerY + radius)} c W n`);
    page.commands.push(`${formatNumber(drawWidth)} 0 0 ${formatNumber(drawHeight)} ${formatNumber(drawX)} ${formatNumber(drawY)} cm /Logo Do`);
    page.commands.push('Q');
  }

  save() {
    for (const page of this.pages) {
      const stream = page.commands.join('\n');
      this.setObject(page.contentId, `<< /Length ${byteLength(stream)} >>\nstream\n${stream}\nendstream`);
      const xObjects = this.logoImageId ? `/XObject << /Logo ${this.logoImageId} 0 R >>` : '';
      this.setObject(page.pageId, `<< /Type /Page /Parent ${this.pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${this.fontRegularId} 0 R /F2 ${this.fontBoldId} 0 R /F3 ${this.fontObliqueId} 0 R >> /ExtGState << /GS1 ${this.watermarkStateId} 0 R /GS2 ${this.panelStateId} 0 R >> ${xObjects} >> /Contents ${page.contentId} 0 R >>`);
    }

    this.setObject(this.pagesId, `<< /Type /Pages /Kids [${this.pages.map((page) => `${page.pageId} 0 R`).join(' ')}] /Count ${this.pages.length} >>`);
    this.setObject(this.catalogId, `<< /Type /Catalog /Pages ${this.pagesId} 0 R >>`);

    const chunks: string[] = ['%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'];
    const offsets: number[] = [0];
    let offset = byteLength(chunks[0]);

    this.objects.forEach((object, index) => {
      offsets.push(offset);
      const prefix = `${index + 1} 0 obj\n`;
      const suffix = '\nendobj\n';
      chunks.push(prefix, object, suffix);
      offset += byteLength(prefix) + byteLength(object) + byteLength(suffix);
    });

    const xrefOffset = offset;
    const xrefRows = offsets.map((item, index) => (index === 0 ? '0000000000 65535 f ' : `${String(item).padStart(10, '0')} 00000 n `));
    const trailer = `xref\n0 ${this.objects.length + 1}\n${xrefRows.join('\n')}\ntrailer\n<< /Size ${this.objects.length + 1} /Root ${this.catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    chunks.push(trailer);
    return new Blob(chunks, { type: 'application/pdf' });
  }

  private addObject(value: string) {
    this.objects.push(value);
    return this.objects.length;
  }

  private setObject(id: number, value: string) {
    this.objects[id - 1] = value;
  }

  private addStream(bytes: Uint8Array, dictionary: string) {
    this.objects.push(`${dictionary}\nstream\n${bytesToHexString(bytes)}>\nendstream`);
    return this.objects.length;
  }
}

class ProposalPdfRenderer {
  private currentPage: PageState;
  private pageNumber = 0;
  private y = PAGE_HEIGHT - 118;

  constructor(
    private readonly pdf: PdfBuilder,
    private readonly proposal: ProposalPdfRecord,
    private readonly organization: OrganizationSettings | null,
  ) {
    this.currentPage = this.pdf.addPage();
  }

  render() {
    this.renderCover();

    this.startContentPage();
    this.section('EXECUTIVE SUMMARY');
    this.paragraph(buildExecutiveSummary(this.proposal, this.organization), 12);
    this.section('SCOPE OF WORK');
    this.keyValueTable([
      ['Project / Proposal', clean(this.proposal.proposal_name) || proposalSubtitle(this.proposal)],
      ['Services', buildServiceDescription(this.proposal)],
      ['Property / Site', clean(this.proposal.site_address) || 'Property or operating area to be confirmed with client.'],
      ['Deliverables', buildDeliverables()],
      ['Exclusions', 'Work not expressly included above is excluded unless added by written change authorization.'],
    ]);

    this.startContentPage();
    this.section('PERSONNEL', 'Crew assignments are confirmed before scheduling and matched to the site requirements.');
    this.table(
      [
        ['Role', 'Assigned Individual', 'Credentials / Notes'],
        ['Remote Pilot in Command', clean(this.proposal.proposed_rpic_name) || clean(this.proposal.proposed_rpic) || 'To be assigned', clean(this.proposal.proposed_rpic_credentials) || 'Credentials verified before operation'],
        ...(clean(this.proposal.proposed_crew) ? [['Crew / Support', clean(this.proposal.proposed_crew), 'Assigned for site support as required']] : []),
      ],
      [130, 170, 187],
    );
    this.section('EQUIPMENT', 'Equipment may be adjusted before deployment to match site conditions and deliverable requirements.');
    this.table(
      [
        ['Equipment', 'Purpose'],
        ...buildEquipmentRows(this.proposal),
      ],
      [250, 237],
    );
    this.section('PRELIMINARY HAZARD ASSESSMENT', 'Final site-specific hazards are verified before flight.');
    this.table(
      [
        ['Hazard', 'Category', 'Mitigation'],
        ...buildHazardRows(this.proposal),
      ],
      [150, 95, 242],
    );

    this.startContentPage();
    this.section('AIRSPACE REVIEW', 'Airspace conditions are rechecked before flight.');
    this.keyValueTable([
      ['Airspace Classification', clean(this.proposal.airspace_class) || PLACEHOLDER],
      ['Nearby Airport', PLACEHOLDER],
      ['LAANC Requirement', booleanDisplay(this.proposal.laanc_required)],
      ['Preliminary Operational Finding', buildAirspaceFindings(this.proposal)],
    ]);
    this.section('SAFETY COMMITMENT');
    this.bullets([
      'Work is planned around site access, weather, airspace, people, property, and mission constraints.',
      'The crew verifies current conditions before flight and coordinates with the client when conditions change.',
      'Operations may be delayed, modified, or stopped when safety or quality conditions require it.',
    ]);
    this.section('PRICING');
    const amount = currency(this.proposal.proposal_amount);
    this.table(
      [
        ['Service Description', 'Qty', 'Unit Price', 'Total'],
        [buildServiceDescription(this.proposal), amount ? '1' : '-', amount || 'TBD', amount || 'TBD'],
        ['TOTAL PROPOSAL PRICE', '', '', amount || 'TBD'],
      ],
      [237, 50, 100, 100],
      { totalRowIndex: 2 },
    );
    this.section('ASSUMPTIONS');
    this.bullets([
      'Weather, safe site access, and client coordination are required.',
      'Airspace authorization availability is assumed when applicable.',
      'Scope changes or additional site requirements may require written authorization.',
    ]);
    this.section('ACCEPTANCE');
    this.paragraph('Signature constitutes acceptance of the scope, pricing, and conditions in this proposal.', 8);
    this.signatureBlock();
  }

  private renderCover() {
    this.pageNumber = 1;
    this.watermark(this.currentPage);
    const companyName = companyNameFor(this.organization);
    const logo = this.pdf.getLogo();
    const centerX = PAGE_WIDTH / 2;
    const coverTextWidth = PAGE_WIDTH - (MARGIN + 36) * 2;
    const coverTextX = centerX - coverTextWidth / 2;

    if (logo) {
      this.pdf.drawCircularImage(this.currentPage, centerX, PAGE_HEIGHT - 156, 108);
    } else {
      this.pdf.drawWrappedText(this.currentPage, companyName, coverTextX, PAGE_HEIGHT - 148, coverTextWidth, { size: 24, font: 'bold', color: NAVY, align: 'center', lineHeight: 28 });
    }

    this.pdf.drawText(this.currentPage, 'AERIAL SERVICES PROPOSAL', centerX, PAGE_HEIGHT - 270, { size: 29, font: 'bold', color: NAVY, align: 'center' });
    this.pdf.drawWrappedText(this.currentPage, proposalSubtitle(this.proposal), coverTextX, PAGE_HEIGHT - 302, coverTextWidth, { size: 13.5, color: GRAY, align: 'center', lineHeight: 16 });
    this.pdf.drawLine(this.currentPage, MARGIN + 96, PAGE_HEIGHT - 332, PAGE_WIDTH - MARGIN - 96, PAGE_HEIGHT - 332, BLUE, 1.1);

    this.coverInfoBlock(PAGE_HEIGHT - 412);
    this.footer(this.currentPage, this.pageNumber);
  }

  private startContentPage() {
    this.pageNumber += 1;
    this.currentPage = this.pdf.addPage();
    this.watermark(this.currentPage);
    this.header(this.currentPage);
    this.footer(this.currentPage, this.pageNumber);
    this.y = PAGE_HEIGHT - 78;
  }

  private header(page: PageState) {
    const companyName = companyNameFor(this.organization);
    this.pdf.drawText(page, companyName, MARGIN, PAGE_HEIGHT - 30, { size: 10.5, font: 'bold', color: NAVY });
    this.pdf.drawWrappedText(page, organizationAddress(this.organization), MARGIN, PAGE_HEIGHT - 41, 330, { size: 6, color: GRAY, lineHeight: 7.4 });
    this.pdf.drawText(page, organizationContact(this.organization), MARGIN, PAGE_HEIGHT - 53, { size: 6, color: GRAY });
    const logo = this.pdf.getLogo();
    if (logo) this.pdf.drawImage(page, PAGE_WIDTH - 88, PAGE_HEIGHT - 54, 31, (31 * logo.height) / logo.width);
    this.pdf.drawLine(page, MARGIN, PAGE_HEIGHT - 64, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 64, BLUE, 0.9);
  }

  private footer(page: PageState, pageNumber: number) {
    const y = 24;
    this.pdf.drawText(page, 'Prepared Using DroneSMS', MARGIN, y, { size: 7, color: GRAY });
    this.pdf.drawText(page, `Proposal ${proposalNumber(this.proposal)} | Confidential`, PAGE_WIDTH / 2, y, { size: 7, color: GRAY, align: 'center' });
    if (pageNumber > 1) this.pdf.drawText(page, `Page ${pageNumber}`, PAGE_WIDTH - MARGIN, y, { size: 7, color: GRAY, align: 'right' });
  }

  private watermark(page: PageState) {
    const logo = this.pdf.getLogo();
    if (logo) {
      this.pdf.drawCircularImage(page, PAGE_WIDTH / 2, PAGE_HEIGHT / 2, 389, WATERMARK_OPACITY);
      return;
    }
    this.pdf.drawText(page, companyNameFor(this.organization), PAGE_WIDTH / 2, PAGE_HEIGHT / 2, { size: 36, font: 'bold', color: LIGHT_GRAY, align: 'center' });
  }

  private section(title: string, subtitle?: string) {
    this.ensureSpace(subtitle ? 48 : 34);
    this.pdf.drawText(this.currentPage, title, MARGIN, this.y, { size: 12.5, font: 'bold', color: NAVY });
    this.pdf.drawLine(this.currentPage, MARGIN, this.y - 7, PAGE_WIDTH - MARGIN, this.y - 7, BLUE, 1.05);
    this.y -= 20;
    if (subtitle) this.y = this.pdf.drawWrappedText(this.currentPage, subtitle, MARGIN, this.y, PAGE_WIDTH - MARGIN * 2, { size: 8.6, font: 'oblique', color: GRAY, lineHeight: 11 }) - 3;
  }

  private paragraph(text: string, spacing = 16) {
    this.ensureSpace(80);
    this.y = this.pdf.drawWrappedText(this.currentPage, text, MARGIN, this.y, PAGE_WIDTH - MARGIN * 2, { size: 9.6, color: NAVY, lineHeight: 12.8 }) - spacing;
  }

  private bullets(items: string[]) {
    for (const item of items) {
      this.ensureSpace(21);
      this.pdf.drawText(this.currentPage, '•', MARGIN + 5, this.y, { size: 9.5, color: BLUE, font: 'bold' });
      this.y = this.pdf.drawWrappedText(this.currentPage, item, MARGIN + 18, this.y, PAGE_WIDTH - MARGIN * 2 - 18, { size: 9.4, color: NAVY, lineHeight: 12.4 }) - 3;
    }
    this.y -= 6;
  }

  private keyValueTable(rows: Array<[string, string]>) {
    this.table([['Item', 'Details'], ...rows], [155, 332]);
  }

  private table(rows: TableCell[][], columnWidths: number[], options: TableOptions = {}) {
    const columns = rows[0].map((header, index) => ({ header: String(header ?? ''), width: columnWidths[index] ?? 100 }));
    this.drawTable(columns, rows.slice(1), options);
  }

  private drawTable(columns: TableColumn[], rows: TableCell[][], options: TableOptions) {
    const x = MARGIN;
    const tableWidth = columns.reduce((sum, column) => sum + column.width, 0);
    const headerHeight = 20;
    this.ensureSpace(headerHeight + 28);
    this.pdf.drawRect(this.currentPage, x, this.y - headerHeight + 6, tableWidth, headerHeight, { fill: NAVY });
    let currentX = x;
    columns.forEach((column) => {
      this.pdf.drawText(this.currentPage, column.header, currentX + 6, this.y - 8, { size: 8, font: 'bold', color: WHITE });
      currentX += column.width;
    });
    this.pdf.drawLine(this.currentPage, x, this.y - headerHeight + 6, x + tableWidth, this.y - headerHeight + 6, BLUE, 0.9);
    this.y -= headerHeight;

    rows.forEach((row, rowIndex) => {
      const cellLines = row.map((cell, cellIndex) => wrapText(normalizeTableCellText(cell), columns[cellIndex].width - 12, 8));
      const rowHeight = Math.max(options.minRowHeight ?? 21, ...cellLines.map((lines) => lines.length * 10 + 10));
      this.ensureSpace(rowHeight + 10);
      const rowY = this.y - rowHeight + 6;
      const isTotal = options.totalRowIndex === rowIndex + 1;
      const fill = isTotal ? LIGHT_BLUE : rowIndex % 2 === 1 ? ZEBRA : undefined;
      const opacity = isTotal ? TOTAL_ROW_OPACITY : fill ? TABLE_ROW_OPACITY : undefined;
      this.pdf.drawRect(this.currentPage, x, rowY, tableWidth, rowHeight, { fill, stroke: LIGHT_GRAY, strokeWidth: 0.35, opacity });
      currentX = x;
      columns.forEach((column, cellIndex) => {
        if (cellIndex > 0) this.pdf.drawLine(this.currentPage, currentX, rowY, currentX, rowY + rowHeight, LIGHT_GRAY, 0.35);
        const lines = cellLines[cellIndex];
        lines.forEach((line, lineIndex) => {
          const textX = column.align === 'right' ? currentX + column.width - 6 : currentX + 6;
          this.pdf.drawText(this.currentPage, line, textX, this.y - 8 - lineIndex * 10, { size: 8, font: isTotal ? 'bold' : 'regular', color: NAVY, align: column.align });
        });
        currentX += column.width;
      });
      this.y -= rowHeight;
    });
    this.y -= 12;
  }

  private coverInfoBlock(startY: number) {
    const rows: Array<[string, string]> = [
      ['Proposal Number', proposalNumber(this.proposal)],
      ['Date', formatDate(this.proposal.created_at) || 'Date to be confirmed'],
      ['Valid Through', formatDate(this.proposal.valid_until) || 'Validity date to be confirmed'],
      ['Client', clientDisplay(this.proposal)],
      ['Property', clean(this.proposal.site_address) || 'Property or operating area to be confirmed'],
      ['Prepared By', preparedByDisplay(this.proposal, this.organization)],
    ];
    const blockX = MARGIN + 18;
    const blockWidth = PAGE_WIDTH - (MARGIN + 18) * 2;
    const rowHeight = 42;
    const blockHeight = rows.length * rowHeight + 42;
    this.pdf.drawRect(this.currentPage, blockX, startY - blockHeight, blockWidth, blockHeight, { fill: SOFT_PANEL, stroke: LIGHT_GRAY, strokeWidth: 0.45, opacity: 0.5 });
    this.pdf.drawText(this.currentPage, 'PROPOSAL INFORMATION', blockX + 28, startY - 29, { size: 8.8, font: 'bold', color: BLUE });

    let y = startY - 60;
    rows.forEach((row) => {
      this.pdf.drawText(this.currentPage, row[0].toUpperCase(), blockX + 28, y, { size: 7.8, font: 'bold', color: GRAY });
      this.pdf.drawWrappedText(this.currentPage, row[1], blockX + 164, y, blockWidth - 198, { size: 9.5, color: NAVY, lineHeight: 11.8 });
      y -= rowHeight;
    });
  }

  private signatureBlock() {
    this.ensureSpace(128);
    const panelHeight = 116;
    const panelY = this.y - panelHeight;
    const panelWidth = PAGE_WIDTH - MARGIN * 2;
    this.pdf.drawRect(this.currentPage, MARGIN, panelY, panelWidth, panelHeight, { fill: SOFT_PANEL, stroke: LIGHT_GRAY, strokeWidth: 0.6, opacity: PANEL_OPACITY });
    this.pdf.drawText(this.currentPage, 'Client Authorization', MARGIN + 18, this.y - 17, { size: 11.5, font: 'bold', color: NAVY });

    const leftX = MARGIN + 18;
    const rightX = PAGE_WIDTH / 2 + 14;
    const lineWidth = 190;
    const firstRowY = this.y - 49;
    const secondRowY = this.y - 88;
    this.signatureField('Authorized Name', leftX, firstRowY, lineWidth);
    this.signatureField('Title', rightX, firstRowY, lineWidth);
    this.signatureField('Signature', leftX, secondRowY, lineWidth);
    this.signatureField('Date', rightX, secondRowY, lineWidth);
    this.y = panelY - 10;
  }

  private signatureField(label: string, x: number, y: number, width: number) {
    this.pdf.drawLine(this.currentPage, x, y, x + width, y, LIGHT_GRAY, 1);
    this.pdf.drawText(this.currentPage, label, x, y - 11, { size: 7.6, font: 'regular', color: GRAY });
  }

  private ensureSpace(required: number) {
    if (this.y - required > 52) return;
    this.startContentPage();
  }
}

export async function generateProposalPdf(proposalId: string) {
  const proposal = await loadProposalForPdf(proposalId);
  const organization = proposal.organization_id ? await loadOrganizationSettingsById(proposal.organization_id) : null;
  const logo = await loadLogoImage(organization);
  const pdf = new PdfBuilder(logo);
  new ProposalPdfRenderer(pdf, proposal, organization).render();
  const blob = pdf.save();
  downloadBlob(blob, `Proposal-${sanitizeFileName(proposalNumber(proposal))}.pdf`);
}

async function loadProposalForPdf(proposalId: string) {
  const { data, error } = await supabase
    .from('proposals')
    .select('id, organization_id, user_id, proposal_number, proposal_name, client_name, contact_name, phone, email, service_type, site_address, description, proposed_rpic, proposed_crew, proposed_aircraft, proposed_rpic_name, proposed_rpic_credentials, proposed_rpic_bio, airspace_class, laanc_required, additional_authorization_required, hazard, proposed_mitigation, hazard_assessment, proposal_equipment, proposal_amount, valid_until, created_at')
    .eq('id', proposalId)
    .is('deleted_at', null)
    .single();

  if (error) throw error;
  return data as ProposalPdfRecord;
}

async function loadLogoImage(organization: OrganizationSettings | null): Promise<PdfImage | null> {
  const url = getOrganizationLogoUrl(organization);
  if (!url) return null;

  try {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Unable to load logo.'));
      image.src = url;
    });

    const canvas = document.createElement('canvas');
    const maxDimension = 800;
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
    const bytes = dataUrlToBytes(dataUrl);
    return { bytes, width: canvas.width, height: canvas.height };
  } catch {
    return null;
  }
}

function buildExecutiveSummary(proposal: ProposalPdfRecord, organization: OrganizationSettings | null) {
  const operatorName = companyNameFor(organization);
  const contactName = clean(proposal.contact_name) || 'your team';
  const clientName = clean(proposal.client_name) || 'your organization';
  const siteAddress = clean(proposal.site_address) || 'the identified property or operating area';
  const serviceDescription = withLeadingArticle(lowerFirst(buildServiceDescription(proposal).replace(/\.$/, '')));
  const validThrough = formatLongDate(proposal.valid_until) || 'the validity date stated in this proposal';
  const rpicName = clean(proposal.proposed_rpic_name) || clean(proposal.proposed_rpic);

  const qualifications = rpicName
    ? `${rpicName}, FAA Part 107 certificated Remote Pilot in Command, will lead all field operations supported by a trained crew operating under ${operatorName}'s documented Safety Management System. Our aerial approach provides safe, efficient access to the work area while reducing the need for personnel to operate from elevated, difficult-to-access, or otherwise hazardous positions.`
    : `All field operations will be led by a FAA Part 107 certificated Remote Pilot in Command, supported by a trained crew operating under ${operatorName}'s documented Safety Management System. Our aerial approach provides safe, efficient access to the work area while reducing the need for personnel to operate from elevated, difficult-to-access, or otherwise hazardous positions.`;

  return [
    `${operatorName} is pleased to submit this proposal to ${contactName} at ${clientName} for ${serviceDescription} at ${siteAddress}. Our goal is to deliver professional, well-documented results while keeping the engagement safe, efficient, and minimally disruptive to people and property.`,
    qualifications,
    `Upon completion, ${clientName} will receive documentation prepared according to the accepted scope and site conditions. This proposal is valid through ${validThrough}. We are ready to move forward upon your authorization and will follow up within one business day to confirm scheduling.`,
  ].join('\n\n');
}

function buildServiceDescription(proposal: ProposalPdfRecord) {
  return toNounPhrase(clean(proposal.description) || clean(proposal.service_type)) || 'Aerial services to be confirmed with the client.';
}

function toNounPhrase(serviceDescription: string) {
  const value = clean(serviceDescription).replace(/^\s*[^-–—:]{2,80}\s*[-–—:]\s+/, '').trim();
  return value || clean(serviceDescription);
}

function lowerFirst(value: string) {
  if (!value) return value;
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function withLeadingArticle(value: string) {
  if (!value || /^(the|a|an)\s+/i.test(value)) return value;
  return `the ${value}`;
}

function buildDeliverables() {
  return 'Prepared according to the accepted scope, property conditions, and client coordination requirements.';
}


function normalizeProposalEquipment(value: unknown): ProposalEquipmentAssignment[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const record = item as Partial<ProposalEquipmentAssignment>;
      const equipmentId = typeof record.equipment_id === 'string' ? record.equipment_id : '';
      const equipmentName = typeof record.equipment_name === 'string' ? record.equipment_name : '';
      if (!equipmentId || !equipmentName) return null;

      return {
        equipment_id: equipmentId,
        equipment_name: equipmentName,
        equipment_type: typeof record.equipment_type === 'string' ? record.equipment_type : '',
        make: typeof record.make === 'string' ? record.make : null,
        model: typeof record.model === 'string' ? record.model : null,
        purpose: typeof record.purpose === 'string' ? record.purpose : ''
      } satisfies ProposalEquipmentAssignment;
    })
    .filter((item): item is ProposalEquipmentAssignment => Boolean(item));
}

function buildEquipmentRows(proposal: ProposalPdfRecord): TableCell[][] {
  const proposalEquipment = normalizeProposalEquipment(proposal.proposal_equipment);
  if (!proposalEquipment.length) {
    return [[clean(proposal.proposed_aircraft) || 'Aircraft/equipment to be assigned before deployment', clean(proposal.service_type) || 'Commercial UAS operation']];
  }

  return proposalEquipment.map((item) => {
    const makeModel = [item.make, item.model].filter(Boolean).join(' ').trim();
    const equipmentName = makeModel ? `${item.equipment_name} — ${makeModel}` : item.equipment_name;
    return [equipmentName, clean(item.purpose) || 'Purpose to be confirmed before deployment'];
  });
}

function buildHazardRows(proposal: ProposalPdfRecord): TableCell[][] {
  const hazards = normalizeSelectedHazards(proposal.hazard_assessment);
  if (!hazards.length) {
    return [['Preliminary hazards', 'General', clean(proposal.proposed_mitigation) || 'Final hazards verified before flight.']];
  }

  const displayedHazards = hazards
    .map((hazard) => [getSelectedHazardName(hazard), hazard.category || 'General', clean(hazard.mitigation)] as TableCell[])
    .filter((row) => clean(String(row[2] ?? '')));

  return displayedHazards.length ? displayedHazards : [['Preliminary hazards', 'General', clean(proposal.proposed_mitigation) || 'Final hazards verified before flight.']];
}

function buildAirspaceFindings(proposal: ProposalPdfRecord) {
  if (proposal.laanc_required === true) {
    return 'LAANC authorization will be requested prior to operations. Final airspace conditions will be confirmed during mission planning.';
  }

  if (proposal.additional_authorization_required === true) {
    return 'Additional authorization may be required prior to operations. Final airspace conditions will be confirmed during mission planning.';
  }

  return 'No additional airspace authorization is anticipated based on the information available at proposal stage. Airspace conditions will be re-verified during mission planning and on the day of operations.';
}

function companyNameFor(organization: OrganizationSettings | null) {
  return clean(organization?.companyName) || 'Company Name Not Provided';
}

function clientDisplay(proposal: ProposalPdfRecord) {
  const contact = clean(proposal.contact_name);
  const company = clean(proposal.client_name);
  if (contact && company && contact !== company) return `${contact}, ${company}`;
  return contact || company || 'client to be confirmed';
}

function preparedByDisplay(proposal: ProposalPdfRecord, organization: OrganizationSettings | null) {
  return clean(proposal.proposed_rpic_name) || clean(proposal.proposed_rpic) || companyNameFor(organization);
}

function organizationAddress(organization: OrganizationSettings | null) {
  return clean(organization?.address) || 'Company address not provided in Settings';
}

function organizationContact(organization: OrganizationSettings | null) {
  const website = clean(organization?.website);
  return [clean(organization?.phone), clean(organization?.email), website].filter(Boolean).join(' | ') || 'Company contact details not provided in Settings';
}

function proposalSubtitle(proposal: ProposalPdfRecord) {
  const serviceType = clean(proposal.service_type);
  if (!serviceType) return 'Commercial UAS Operations Proposal';
  if (serviceType.toLowerCase().includes('clean')) return 'Drone-Based Exterior Cleaning';
  if (serviceType.toLowerCase().includes('thermal')) return 'Drone-Based Thermal Inspection';
  return serviceType;
}

function proposalNumber(proposal: Pick<ProposalPdfRecord, 'proposal_number' | 'id'>) {
  return clean(proposal.proposal_number) || proposal.id.slice(0, 8).toUpperCase();
}

function booleanDisplay(value: boolean | null) {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return PLACEHOLDER;
}

function clean(value: string | null | undefined) {
  return value?.trim() ?? '';
}

function formatDate(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).format(date);
}

function formatLongDate(value: string | null | undefined) {
  if (!value) return '';
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(date);
}

function currency(value: number | string | null) {
  if (value === null || value === undefined || value === '') return '';
  const amount = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(amount)) return String(value);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function hexToRgb(hex: string) {
  const value = hex.replace('#', '');
  return { r: parseInt(value.slice(0, 2), 16) / 255, g: parseInt(value.slice(2, 4), 16) / 255, b: parseInt(value.slice(4, 6), 16) / 255 };
}

function formatNumber(value: number) {
  return Number(value.toFixed(3)).toString();
}

function toPdfText(value: string) {
  return value
    .replace(/·/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/[^\x09\x0A\x0D\x20-\x7E•]/g, '');
}

function normalizeTableCellText(value: TableCell) {
  return String(value ?? '').replace(/(?:\u00e2\u00a2|\u00e2\u20ac\u00a2|•)/g, '-');
}

function pdfTextHex(value: string) {
  let hex = '';
  for (const character of value) {
    const code = character === '•' ? 0x95 : character.charCodeAt(0);
    const byte = code >= 0x20 && code <= 0x7e ? code : code === 0x95 ? code : 0x3f;
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

function measureText(value: string, size: number) {
  return value.length * size * 0.52;
}

function wrapText(value: string, maxWidth: number, size: number) {
  const paragraphs = toPdfText(value || '').split(/\n+/);
  const lines: string[] = [];
  paragraphs.forEach((paragraph) => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push('');
      return;
    }
    let line = '';
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (measureText(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    });
    if (line) lines.push(line);
  });
  return lines.length ? lines : [''];
}

function byteLength(value: string) {
  return new TextEncoder().encode(value).length;
}

function bytesToHexString(bytes: Uint8Array) {
  let hex = '';
  bytes.forEach((byte) => {
    hex += byte.toString(16).padStart(2, '0');
  });
  return hex;
}

function dataUrlToBytes(dataUrl: string) {
  const base64 = dataUrl.split(',')[1] ?? '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '') || 'proposal';
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
