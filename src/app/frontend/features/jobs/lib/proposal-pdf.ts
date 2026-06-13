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
  proposal_amount: number | string | null;
  valid_until: string | null;
  created_at: string | null;
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
    this.fontRegularId = this.addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    this.fontBoldId = this.addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
    this.fontObliqueId = this.addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>');
    this.watermarkStateId = this.addObject('<< /Type /ExtGState /ca 0.06 /CA 0.06 >>');
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
    page.commands.push(`BT /${fontName} ${formatNumber(size)} Tf ${formatNumber(color.r)} ${formatNumber(color.g)} ${formatNumber(color.b)} rg ${formatNumber(drawX)} ${formatNumber(y)} Td (${escapePdfString(cleanText)}) Tj ET`);
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
    this.section('EXECUTIVE SUMMARY', 'A concise overview of the requested service, client objective, and expected deliverables.');
    this.paragraph(buildExecutiveSummary(this.proposal), 12);
    this.section('SCOPE OF WORK', 'Scope reflects the currently accepted proposal details and may be refined by written client authorization.');
    this.keyValueTable([
      ['Project / Proposal', clean(this.proposal.proposal_name) || proposalSubtitle(this.proposal)],
      ['Services', buildServiceDescription(this.proposal)],
      ['Property / Site', clean(this.proposal.site_address) || 'Property or operating area to be confirmed with client.'],
      ['Deliverables', buildDeliverables(this.proposal)],
      ['Exclusions', 'Work not expressly included above is excluded unless added by written change authorization.'],
    ]);

    this.startContentPage();
    this.section('PERSONNEL', 'Final crew assignments are confirmed before scheduling and tailored to the service requirements.');
    this.table(
      [
        ['Role', 'Assigned Individual', 'Credentials / Notes'],
        ['Remote Pilot in Command', clean(this.proposal.proposed_rpic_name) || clean(this.proposal.proposed_rpic) || 'To be assigned', clean(this.proposal.proposed_rpic_credentials) || 'Credentials verified before operation'],
        ...(clean(this.proposal.proposed_crew) ? [['Crew / Support', clean(this.proposal.proposed_crew), 'Assigned for site support as required']] : []),
      ],
      [130, 170, 187],
    );
    this.section('EQUIPMENT', 'Equipment assignments may be adjusted before deployment based on site conditions and service requirements.');
    this.table(
      [
        ['Equipment', 'Purpose'],
        [clean(this.proposal.proposed_aircraft) || 'Aircraft/equipment to be assigned before deployment', clean(this.proposal.service_type) || 'Commercial UAS operation'],
      ],
      [250, 237],
    );
    this.section('PRELIMINARY HAZARD ASSESSMENT', 'Concise proposal-stage hazards and mitigations. Final site conditions are confirmed before work begins.');
    this.table(
      [
        ['Hazard', 'Category', 'Mitigation'],
        ...buildHazardRows(this.proposal),
      ],
      [150, 95, 242],
    );

    this.startContentPage();
    this.section('AIRSPACE REVIEW', 'Brief planning summary. Airspace conditions are confirmed again before operation.');
    this.keyValueTable([
      ['Airspace Classification', clean(this.proposal.airspace_class) || PLACEHOLDER],
      ['Nearby Airport', PLACEHOLDER],
      ['LAANC Requirement', booleanDisplay(this.proposal.laanc_required)],
      ['Preliminary Operational Finding', buildAirspaceFindings(this.proposal)],
    ]);
    this.section('SAFETY COMMITMENT', 'A professional operating culture built on planning, coordination, and disciplined field execution.');
    this.bullets([
      'Work is planned around site access, weather, airspace, people, property, and mission constraints.',
      'The crew verifies current conditions before flight and coordinates with the client when conditions change.',
      'Operations may be delayed, modified, or stopped when safety or quality conditions require it.',
    ]);
    this.section('PRICING', 'Pricing is based on the stated scope and proposal conditions.');
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
    this.section('ASSUMPTIONS', 'Standard proposal conditions for scheduling and performance.');
    this.bullets([
      'Weather, safe site access, and client coordination are required.',
      'Airspace authorization availability is assumed when applicable.',
      'Scope changes or additional site requirements may require written authorization.',
    ]);
    this.section('ACCEPTANCE', 'Acceptance authorizes scheduling coordination and preparation for service delivery.');
    this.paragraph('Signature constitutes acceptance of the scope, pricing, and conditions in this proposal.', 8);
    this.signatureBlock();
  }

  private renderCover() {
    this.pageNumber = 1;
    this.watermark(this.currentPage);
    const companyName = companyNameFor(this.organization);
    const logo = this.pdf.getLogo();

    if (logo) {
      this.pdf.drawCircularImage(this.currentPage, PAGE_WIDTH / 2, PAGE_HEIGHT - 156, 108);
    } else {
      this.pdf.drawWrappedText(this.currentPage, companyName, MARGIN + 40, PAGE_HEIGHT - 148, PAGE_WIDTH - (MARGIN + 40) * 2, { size: 24, font: 'bold', color: NAVY, align: 'center', lineHeight: 28 });
    }

    this.pdf.drawText(this.currentPage, 'AERIAL SERVICES PROPOSAL', PAGE_WIDTH / 2, PAGE_HEIGHT - 270, { size: 29, font: 'bold', color: NAVY, align: 'center' });
    this.pdf.drawWrappedText(this.currentPage, proposalSubtitle(this.proposal), MARGIN + 36, PAGE_HEIGHT - 302, PAGE_WIDTH - (MARGIN + 36) * 2, { size: 13.5, color: GRAY, align: 'center', lineHeight: 16 });
    this.pdf.drawLine(this.currentPage, MARGIN + 96, PAGE_HEIGHT - 332, PAGE_WIDTH - MARGIN - 96, PAGE_HEIGHT - 332, BLUE, 1.1);

    this.coverInfoBlock(PAGE_HEIGHT - 386);
    this.footer(this.currentPage, this.pageNumber);
  }

  private startContentPage() {
    this.pageNumber += 1;
    this.currentPage = this.pdf.addPage();
    this.watermark(this.currentPage);
    this.header(this.currentPage);
    this.footer(this.currentPage, this.pageNumber);
    this.y = PAGE_HEIGHT - 92;
  }

  private header(page: PageState) {
    const companyName = companyNameFor(this.organization);
    this.pdf.drawText(page, companyName, MARGIN, PAGE_HEIGHT - 36, { size: 10.8, font: 'bold', color: NAVY });
    this.pdf.drawWrappedText(page, organizationAddress(this.organization), MARGIN, PAGE_HEIGHT - 49, 330, { size: 7, color: GRAY, lineHeight: 8.5 });
    this.pdf.drawText(page, organizationContact(this.organization), MARGIN, PAGE_HEIGHT - 64, { size: 7, color: GRAY });
    const logo = this.pdf.getLogo();
    if (logo) this.pdf.drawImage(page, PAGE_WIDTH - 94, PAGE_HEIGHT - 62, 38, (38 * logo.height) / logo.width);
    this.pdf.drawLine(page, MARGIN, PAGE_HEIGHT - 74, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 74, BLUE, 0.9);
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
      this.pdf.drawCircularImage(page, PAGE_WIDTH / 2, PAGE_HEIGHT / 2, 389, 0.06);
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
      const cellLines = row.map((cell, cellIndex) => wrapText(String(cell ?? ''), columns[cellIndex].width - 12, 8));
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
    const blockX = MARGIN + 36;
    const blockWidth = PAGE_WIDTH - (MARGIN + 36) * 2;
    const rowHeight = 36;
    const blockHeight = rows.length * rowHeight + 30;
    this.pdf.drawRect(this.currentPage, blockX, startY - blockHeight, blockWidth, blockHeight, { fill: SOFT_PANEL, stroke: LIGHT_GRAY, strokeWidth: 0.45, opacity: 0.5 });
    this.pdf.drawText(this.currentPage, 'PROPOSAL INFORMATION', blockX + 22, startY - 25, { size: 8.5, font: 'bold', color: BLUE });

    let y = startY - 50;
    rows.forEach((row) => {
      this.pdf.drawText(this.currentPage, row[0].toUpperCase(), blockX + 22, y, { size: 7.5, font: 'bold', color: GRAY });
      this.pdf.drawWrappedText(this.currentPage, row[1], blockX + 150, y, blockWidth - 174, { size: 9.2, color: NAVY, lineHeight: 11 });
      y -= rowHeight;
    });
  }

  private signatureBlock() {
    this.ensureSpace(152);
    const panelHeight = 138;
    const panelY = this.y - panelHeight;
    const panelWidth = PAGE_WIDTH - MARGIN * 2;
    this.pdf.drawRect(this.currentPage, MARGIN, panelY, panelWidth, panelHeight, { fill: SOFT_PANEL, stroke: LIGHT_GRAY, strokeWidth: 0.6, opacity: PANEL_OPACITY });
    this.pdf.drawText(this.currentPage, 'Client Authorization', MARGIN + 18, this.y - 20, { size: 11.5, font: 'bold', color: NAVY });

    const leftX = MARGIN + 18;
    const rightX = PAGE_WIDTH / 2 + 14;
    const lineWidth = 190;
    const firstRowY = this.y - 64;
    const secondRowY = this.y - 108;
    this.signatureField('Authorized Name', leftX, firstRowY, lineWidth);
    this.signatureField('Title', rightX, firstRowY, lineWidth);
    this.signatureField('Signature', leftX, secondRowY, lineWidth);
    this.signatureField('Date', rightX, secondRowY, lineWidth);
    this.y = panelY - 10;
  }

  private signatureField(label: string, x: number, y: number, width: number) {
    this.pdf.drawLine(this.currentPage, x, y, x + width, y, LIGHT_GRAY, 1);
    this.pdf.drawText(this.currentPage, label, x, y + 8, { size: 8.5, font: 'bold', color: GRAY });
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
    .select('id, organization_id, user_id, proposal_number, proposal_name, client_name, contact_name, phone, email, service_type, site_address, description, proposed_rpic, proposed_crew, proposed_aircraft, proposed_rpic_name, proposed_rpic_credentials, proposed_rpic_bio, airspace_class, laanc_required, additional_authorization_required, hazard, proposed_mitigation, hazard_assessment, proposal_amount, valid_until, created_at')
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

function buildExecutiveSummary(proposal: ProposalPdfRecord) {
  const serviceType = clean(proposal.service_type) || 'commercial UAS services';
  const client = clientDisplay(proposal);
  const property = clean(proposal.site_address) || 'the identified property or operating area';
  const serviceDescription = buildServiceDescription(proposal);
  const objective = lowerFirst(serviceDescription.replace(/\.$/, ''));
  const deliverables = buildDeliverables(proposal);

  return [
    `This proposal presents a professional ${serviceType} engagement prepared for ${client}. The objective is ${objective} for the property at ${property}, completed through a planned, coordinated aerial services approach that protects people, property, and schedule quality.`,
    `The work will be performed by assigned UAS personnel using equipment suited to the site and service requirements. Deliverables include ${deliverables.toLowerCase().replace(/\.$/, '')}, with final scheduling and field coordination completed after proposal acceptance.`,
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

function buildDeliverables(proposal: ProposalPdfRecord) {
  const base = buildServiceDescription(proposal) || clean(proposal.proposal_name);
  if (!base) return 'deliverables to be confirmed with the client before scheduling.';
  return `${base} deliverables prepared according to the accepted scope, property conditions, and client coordination requirements.`;
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

function escapePdfString(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/\n/g, '\\n');
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
