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
const GRAY = '#5B6470';
const LIGHT_GRAY = '#D9DEE5';
const ZEBRA = '#F4F7FB';
const WHITE = '#FFFFFF';
const PLACEHOLDER = 'To be verified during mission planning.';

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
  private logoImageId: number | null = null;
  private logo: PdfImage | null = null;

  constructor(logo: PdfImage | null) {
    this.catalogId = this.addObject('');
    this.pagesId = this.addObject('');
    this.fontRegularId = this.addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    this.fontBoldId = this.addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
    this.fontObliqueId = this.addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>');
    this.watermarkStateId = this.addObject('<< /Type /ExtGState /ca 0.07 /CA 0.07 >>');

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

  drawWrappedText(page: PageState, text: string, x: number, y: number, maxWidth: number, options: { size?: number; color?: string; font?: 'regular' | 'bold' | 'oblique'; lineHeight?: number } = {}) {
    const size = options.size ?? 10;
    const lineHeight = options.lineHeight ?? size + 4;
    const lines = wrapText(text, maxWidth, size);
    lines.forEach((line, index) => this.drawText(page, line, x, y - index * lineHeight, options));
    return y - lines.length * lineHeight;
  }

  drawLine(page: PageState, x1: number, y1: number, x2: number, y2: number, color = BLUE, width = 1) {
    const rgb = hexToRgb(color);
    page.commands.push(`${formatNumber(rgb.r)} ${formatNumber(rgb.g)} ${formatNumber(rgb.b)} RG ${formatNumber(width)} w ${formatNumber(x1)} ${formatNumber(y1)} m ${formatNumber(x2)} ${formatNumber(y2)} l S`);
  }

  drawRect(page: PageState, x: number, y: number, width: number, height: number, options: { fill?: string; stroke?: string; strokeWidth?: number } = {}) {
    const segments: string[] = [];
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
    page.commands.push(segments.join(' '));
  }

  drawImage(page: PageState, x: number, y: number, width: number, height: number, opacity = 1) {
    if (!this.logoImageId) return;
    page.commands.push('q');
    if (opacity < 1) page.commands.push('/GS1 gs');
    page.commands.push(`${formatNumber(width)} 0 0 ${formatNumber(height)} ${formatNumber(x)} ${formatNumber(y)} cm /Logo Do`);
    page.commands.push('Q');
  }

  save() {
    for (const page of this.pages) {
      const stream = page.commands.join('\n');
      this.setObject(page.contentId, `<< /Length ${byteLength(stream)} >>\nstream\n${stream}\nendstream`);
      const xObjects = this.logoImageId ? `/XObject << /Logo ${this.logoImageId} 0 R >>` : '';
      this.setObject(page.pageId, `<< /Type /Page /Parent ${this.pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${this.fontRegularId} 0 R /F2 ${this.fontBoldId} 0 R /F3 ${this.fontObliqueId} 0 R >> /ExtGState << /GS1 ${this.watermarkStateId} 0 R >> ${xObjects} >> /Contents ${page.contentId} 0 R >>`);
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
    this.paragraph(buildExecutiveSummary(this.proposal));
    this.section('SCOPE OF WORK');
    this.keyValueTable([
      ['Services to Be Performed', clean(this.proposal.service_type) || clean(this.proposal.description) || 'Service details to be confirmed.'],
      ['Areas Included', clean(this.proposal.site_address) || 'Areas to be confirmed with client.'],
      ['Areas Excluded', 'Areas not expressly included above are excluded unless added by written change authorization.'],
      ['Deliverables', buildDeliverables(this.proposal)],
    ]);

    this.startContentPage();
    this.section('PLANNED PERSONNEL');
    this.table(
      [
        ['Role', 'Assigned Individual', 'Credentials'],
        ['Proposed RPIC', clean(this.proposal.proposed_rpic_name) || clean(this.proposal.proposed_rpic) || 'To be assigned', clean(this.proposal.proposed_rpic_credentials) || 'Credentials to be verified'],
        ...(clean(this.proposal.proposed_crew) ? [['Crew / Support', clean(this.proposal.proposed_crew), 'As assigned for operation']] : []),
      ],
      [120, 170, 197],
    );
    if (clean(this.proposal.proposed_rpic_bio)) this.paragraph(this.proposal.proposed_rpic_bio ?? '', 10);
    this.section('PLANNED EQUIPMENT');
    this.table(
      [
        ['Equipment', 'Purpose'],
        [clean(this.proposal.proposed_aircraft) || 'Aircraft/equipment to be assigned during mission planning', clean(this.proposal.service_type) || 'Commercial UAS operation'],
      ],
      [250, 237],
    );

    this.startContentPage();
    this.section('PRELIMINARY HAZARD ASSESSMENT', 'Auto-generated from hazards selected during proposal development in DroneSMS. A final, site-specific mission assessment is completed prior to flight.');
    const hazards = normalizeSelectedHazards(this.proposal.hazard_assessment);
    this.table(
      [
        ['Hazard', 'Category', 'Preliminary Mitigation'],
        ...(hazards.length
          ? hazards.map((hazard) => [getSelectedHazardName(hazard), hazard.category || 'General', hazard.mitigation || PLACEHOLDER])
          : [['Preliminary hazards', 'General', clean(this.proposal.proposed_mitigation) || 'No proposal hazards selected. Final hazards verified before flight.']]),
      ],
      [150, 95, 242],
    );
    this.section('AIRSPACE REVIEW');
    this.keyValueTable([
      ['Airspace Classification', clean(this.proposal.airspace_class) || PLACEHOLDER],
      ['Nearest Airport', PLACEHOLDER],
      ['LAANC Required', booleanDisplay(this.proposal.laanc_required)],
      ['Additional Authorization Required', booleanDisplay(this.proposal.additional_authorization_required)],
      ['Preliminary Airspace Findings', buildAirspaceFindings(this.proposal)],
    ]);

    this.startContentPage();
    this.section('SAFETY COMMITMENT');
    this.bullets([
      'Preliminary hazard review completed during proposal development.',
      'Final site-specific assessment completed before flight.',
      'Crew briefing completed before operation.',
      'Controls verified prior to flight.',
      'Stop-work authority applies when conditions change.',
    ]);
    this.section('PRICING');
    const amount = currency(this.proposal.proposal_amount);
    this.table(
      [
        ['Service Description', 'Qty', 'Unit Price', 'Total'],
        [clean(this.proposal.service_type) || clean(this.proposal.proposal_name) || 'Aerial services', amount ? '1' : '-', amount || 'TBD', amount || 'TBD'],
        ['TOTAL PROPOSAL PRICE', '', '', amount || 'TBD'],
      ],
      [237, 50, 100, 100],
      { totalRowIndex: 2 },
    );
    this.section('ASSUMPTIONS AND CONDITIONS');
    this.bullets([
      'Weather permitting.',
      'Safe site access required.',
      'Client coordination required.',
      'Airspace authorization availability assumed when applicable.',
    ]);

    this.startContentPage();
    this.section('ACCEPTANCE');
    this.paragraph('Signature constitutes acceptance of the scope, pricing, and conditions. Upon acceptance, the proposal may be converted into an active job in DroneSMS and final mission planning begins.');
    this.signatureBlock();
  }

  private renderCover() {
    this.pageNumber = 1;
    this.watermark(this.currentPage);
    const companyName = companyNameFor(this.organization);
    const logo = this.pdf.getLogo();
    if (logo) this.pdf.drawImage(this.currentPage, PAGE_WIDTH - 170, PAGE_HEIGHT - 160, 96, (96 * logo.height) / logo.width);
    this.pdf.drawText(this.currentPage, companyName, MARGIN, PAGE_HEIGHT - 120, { size: 22, font: 'bold', color: NAVY });
    this.pdf.drawWrappedText(this.currentPage, organizationAddress(this.organization), MARGIN, PAGE_HEIGHT - 142, 330, { size: 10, color: GRAY });
    this.pdf.drawWrappedText(this.currentPage, organizationContact(this.organization), MARGIN, PAGE_HEIGHT - 168, 330, { size: 9, color: GRAY });
    this.pdf.drawLine(this.currentPage, MARGIN, PAGE_HEIGHT - 190, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 190, BLUE, 2);
    this.pdf.drawText(this.currentPage, 'AERIAL SERVICES PROPOSAL', MARGIN, PAGE_HEIGHT - 280, { size: 28, font: 'bold', color: NAVY });
    this.pdf.drawText(this.currentPage, proposalSubtitle(this.proposal), MARGIN, PAGE_HEIGHT - 305, { size: 14, color: GRAY });
    this.infoTable(PAGE_HEIGHT - 365);
    this.footer(this.currentPage, 1);
  }

  private startContentPage() {
    this.pageNumber += 1;
    this.currentPage = this.pdf.addPage();
    this.watermark(this.currentPage);
    this.header(this.currentPage);
    this.footer(this.currentPage, this.pageNumber);
    this.y = PAGE_HEIGHT - 120;
  }

  private header(page: PageState) {
    const companyName = companyNameFor(this.organization);
    this.pdf.drawText(page, companyName, MARGIN, PAGE_HEIGHT - 50, { size: 13, font: 'bold', color: NAVY });
    this.pdf.drawWrappedText(page, organizationAddress(this.organization), MARGIN, PAGE_HEIGHT - 66, 300, { size: 8, color: GRAY });
    this.pdf.drawText(page, organizationContact(this.organization), MARGIN, PAGE_HEIGHT - 90, { size: 8, color: GRAY });
    const logo = this.pdf.getLogo();
    if (logo) this.pdf.drawImage(page, PAGE_WIDTH - 118, PAGE_HEIGHT - 82, 64, (64 * logo.height) / logo.width);
    this.pdf.drawLine(page, MARGIN, PAGE_HEIGHT - 100, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 100, BLUE, 1.2);
  }

  private footer(page: PageState, pageNumber: number) {
    const y = 36;
    const logo = this.pdf.getLogo();
    if (logo) this.pdf.drawImage(page, MARGIN, y - 8, 20, (20 * logo.height) / logo.width);
    this.pdf.drawText(page, 'Prepared Using DroneSMS', logo ? MARGIN + 28 : MARGIN, y, { size: 8, color: GRAY });
    this.pdf.drawText(page, `Proposal ${proposalNumber(this.proposal)} | Confidential`, PAGE_WIDTH / 2, y, { size: 8, color: GRAY, align: 'center' });
    if (pageNumber > 1) this.pdf.drawText(page, `Page ${pageNumber}`, PAGE_WIDTH - MARGIN, y, { size: 8, color: GRAY, align: 'right' });
  }

  private watermark(page: PageState) {
    const logo = this.pdf.getLogo();
    if (logo) {
      const width = 300;
      this.pdf.drawImage(page, (PAGE_WIDTH - width) / 2, (PAGE_HEIGHT - (width * logo.height) / logo.width) / 2, width, (width * logo.height) / logo.width, 0.07);
      return;
    }
    this.pdf.drawText(page, companyNameFor(this.organization), PAGE_WIDTH / 2, PAGE_HEIGHT / 2, { size: 36, font: 'bold', color: LIGHT_GRAY, align: 'center' });
  }

  private section(title: string, subtitle?: string) {
    this.ensureSpace(subtitle ? 58 : 42);
    this.pdf.drawText(this.currentPage, title, MARGIN, this.y, { size: 13, font: 'bold', color: NAVY });
    this.pdf.drawLine(this.currentPage, MARGIN, this.y - 8, PAGE_WIDTH - MARGIN, this.y - 8, BLUE, 1.2);
    this.y -= 24;
    if (subtitle) this.y = this.pdf.drawWrappedText(this.currentPage, subtitle, MARGIN, this.y, PAGE_WIDTH - MARGIN * 2, { size: 9, font: 'oblique', color: GRAY, lineHeight: 12 }) - 4;
  }

  private paragraph(text: string, spacing = 16) {
    this.ensureSpace(80);
    this.y = this.pdf.drawWrappedText(this.currentPage, text, MARGIN, this.y, PAGE_WIDTH - MARGIN * 2, { size: 10, color: NAVY, lineHeight: 14 }) - spacing;
  }

  private bullets(items: string[]) {
    for (const item of items) {
      this.ensureSpace(24);
      this.pdf.drawText(this.currentPage, '-', MARGIN + 5, this.y, { size: 10, color: BLUE, font: 'bold' });
      this.y = this.pdf.drawWrappedText(this.currentPage, item, MARGIN + 18, this.y, PAGE_WIDTH - MARGIN * 2 - 18, { size: 10, color: NAVY, lineHeight: 14 }) - 5;
    }
    this.y -= 8;
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
    const headerHeight = 24;
    this.ensureSpace(headerHeight + 35);
    this.pdf.drawRect(this.currentPage, x, this.y - headerHeight + 6, tableWidth, headerHeight, { fill: NAVY });
    let currentX = x;
    columns.forEach((column) => {
      this.pdf.drawText(this.currentPage, column.header, currentX + 6, this.y - 9, { size: 8.5, font: 'bold', color: WHITE });
      currentX += column.width;
    });
    this.pdf.drawLine(this.currentPage, x, this.y - headerHeight + 6, x + tableWidth, this.y - headerHeight + 6, BLUE, 1.1);
    this.y -= headerHeight;

    rows.forEach((row, rowIndex) => {
      const cellLines = row.map((cell, cellIndex) => wrapText(String(cell ?? ''), columns[cellIndex].width - 12, 8.5));
      const rowHeight = Math.max(options.minRowHeight ?? 24, ...cellLines.map((lines) => lines.length * 11 + 12));
      this.ensureSpace(rowHeight + 10);
      const rowY = this.y - rowHeight + 6;
      const isTotal = options.totalRowIndex === rowIndex + 1;
      const fill = isTotal ? LIGHT_BLUE : rowIndex % 2 === 1 ? ZEBRA : WHITE;
      this.pdf.drawRect(this.currentPage, x, rowY, tableWidth, rowHeight, { fill, stroke: LIGHT_GRAY, strokeWidth: 0.5 });
      currentX = x;
      columns.forEach((column, cellIndex) => {
        if (cellIndex > 0) this.pdf.drawLine(this.currentPage, currentX, rowY, currentX, rowY + rowHeight, LIGHT_GRAY, 0.5);
        const lines = cellLines[cellIndex];
        lines.forEach((line, lineIndex) => {
          const textX = column.align === 'right' ? currentX + column.width - 6 : currentX + 6;
          this.pdf.drawText(this.currentPage, line, textX, this.y - 9 - lineIndex * 11, { size: 8.5, font: isTotal ? 'bold' : 'regular', color: NAVY, align: column.align });
        });
        currentX += column.width;
      });
      this.y -= rowHeight;
    });
    this.y -= 18;
  }

  private infoTable(startY: number) {
    const rows: Array<[string, string]> = [
      ['Proposal Number', proposalNumber(this.proposal)],
      ['Date', formatDate(this.proposal.created_at) || 'Not provided'],
      ['Valid Through', formatDate(this.proposal.valid_until) || 'Not provided'],
      ['Prepared By', clean(this.proposal.proposed_rpic_name) || clean(this.proposal.proposed_rpic) || 'To be assigned'],
      ['Client', clean(this.proposal.contact_name) || clean(this.proposal.client_name) || 'Client to be confirmed'],
      ['Client Company', clean(this.proposal.client_name) || 'Not provided'],
      ['Property Address', clean(this.proposal.site_address) || 'Property address to be confirmed'],
    ];
    let y = startY;
    rows.forEach((row, index) => {
      const rowHeight = 30;
      this.pdf.drawRect(this.currentPage, MARGIN, y - rowHeight, PAGE_WIDTH - MARGIN * 2, rowHeight, { fill: index % 2 === 1 ? ZEBRA : WHITE, stroke: LIGHT_GRAY, strokeWidth: 0.5 });
      this.pdf.drawText(this.currentPage, row[0], MARGIN + 10, y - 19, { size: 9, font: 'bold', color: GRAY });
      this.pdf.drawWrappedText(this.currentPage, row[1], MARGIN + 175, y - 19, PAGE_WIDTH - MARGIN * 2 - 185, { size: 9, color: NAVY, lineHeight: 11 });
      y -= rowHeight;
    });
  }

  private signatureBlock() {
    const labels = ['Name', 'Title', 'Signature', 'Date'];
    this.y -= 20;
    labels.forEach((label) => {
      this.ensureSpace(56);
      this.pdf.drawLine(this.currentPage, MARGIN + 110, this.y, PAGE_WIDTH - MARGIN, this.y, LIGHT_GRAY, 1);
      this.pdf.drawText(this.currentPage, label, MARGIN, this.y + 2, { size: 10, font: 'bold', color: GRAY });
      this.y -= 52;
    });
  }

  private ensureSpace(required: number) {
    if (this.y - required > 70) return;
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
  const client = clean(proposal.client_name) || 'the client';
  const property = clean(proposal.site_address) || 'the identified property';
  const description = clean(proposal.description);
  const summary = `This proposal outlines a professional ${serviceType} engagement for ${client} at ${property}. DroneSMS-supported planning emphasizes safety, clear scope definition, preliminary hazard review, and disciplined mission readiness before operations begin.`;
  return description ? `${description}\n\n${summary}` : summary;
}

function buildDeliverables(proposal: ProposalPdfRecord) {
  const serviceType = clean(proposal.service_type);
  if (!serviceType) return 'Deliverables to be confirmed with the client before scheduling.';
  return `${serviceType} deliverables prepared according to the accepted scope and site conditions.`;
}

function buildAirspaceFindings(proposal: ProposalPdfRecord) {
  const parts = [
    clean(proposal.airspace_class) ? `Preliminary airspace classification: ${clean(proposal.airspace_class)}.` : null,
    proposal.laanc_required === true ? 'LAANC authorization appears applicable.' : proposal.laanc_required === false ? 'LAANC authorization is not currently marked as required.' : null,
    proposal.additional_authorization_required === true ? 'Additional authorization is marked as required.' : null,
  ].filter(Boolean);
  return parts.join(' ') || PLACEHOLDER;
}

function companyNameFor(organization: OrganizationSettings | null) {
  return clean(organization?.companyName) || 'Company Name Not Provided';
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
    .replace(/[•·]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '');
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
