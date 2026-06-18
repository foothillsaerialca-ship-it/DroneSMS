import { supabase } from '@frontend/lib/supabase';
import { saveGeneratedDocument } from '@frontend/features/jobs/lib/generated-documents';
import {
  getOrganizationLogoUrl,
  loadOrganizationSettingsById,
  type OrganizationSettings,
} from '@frontend/features/settings/lib/organization-settings';
import {
  getSelectedHazardName,
  normalizeSelectedHazards,
} from '@frontend/features/safety/lib/preliminary-hazard-library';
import { getProposalScopeDefaults } from '@frontend/features/jobs/lib/proposal-scope';

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
  deliverables: string | null;
  exclusions: string | null;
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
type PacketPhotoImage = PdfImage & { id: string; caption: string | null; timestamp: string | null; hazardId: string | null; hazardName: string | null; photoUrl: string; category: string | null };
type TocGroup = { title: string; items: string[] };
type TableColumn = { header: string; width: number; align?: 'left' | 'right' | 'center' };
type TableCell = string | number | null | undefined;
type TableOptions = { totalRowIndex?: number; minRowHeight?: number };
type PageState = { commands: string[]; contentId: number; pageId: number };
type PdfObjectValue = string | Uint8Array;

class PdfBuilder {
  private readonly objects: PdfObjectValue[] = [];
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
  private imageXObjects: Array<{ name: string; id: number }> = [];

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



  addJpegImage(image: PdfImage) {
    const name = `Img${this.imageXObjects.length + 1}`;
    const id = this.addStream(
      image.bytes,
      `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /DCTDecode] /Length ${image.bytes.length * 2 + 1} >>`,
    );
    this.imageXObjects.push({ name, id });
    return name;
  }

  drawNamedImage(page: PageState, name: string, x: number, y: number, width: number, height: number) {
    page.commands.push('q');
    page.commands.push(`${formatNumber(width)} 0 0 ${formatNumber(height)} ${formatNumber(x)} ${formatNumber(y)} cm /${name} Do`);
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

  appendPdfPages(bytes: Uint8Array) {
    const binary = bytesToBinaryString(bytes);
    const objectMatches = [...binary.matchAll(/(\d+)\s+(\d+)\s+obj\s*([\s\S]*?)\s*endobj/g)];
    if (!objectMatches.length) throw new Error('No PDF objects found.');

    const sourceObjectIds = objectMatches.map((match) => Number(match[1]));
    const idMap = new Map<number, number>();
    sourceObjectIds.forEach((sourceId) => idMap.set(sourceId, this.objects.length + idMap.size + 1));

    const pageSourceIds = objectMatches
      .filter((match) => /\/Type\s*\/Page(?!s)/.test(match[3]))
      .map((match) => Number(match[1]));

    if (!pageSourceIds.length) throw new Error('No PDF pages found.');

    for (const match of objectMatches) {
      const sourceId = Number(match[1]);
      let body = match[3].replace(/(\d+)\s+0\s+R/g, (_ref, refId: string) => `${idMap.get(Number(refId)) ?? Number(refId)} 0 R`);
      if (pageSourceIds.includes(sourceId)) {
        body = body.replace(/\/Parent\s+\d+\s+0\s+R/, `/Parent ${this.pagesId} 0 R`);
      }
      this.objects.push(binaryStringToBytes(body));
    }

    for (const sourcePageId of pageSourceIds) {
      const pageId = idMap.get(sourcePageId);
      if (pageId) this.pages.push({ commands: [], contentId: 0, pageId });
    }

    return pageSourceIds.length;
  }

  save() {
    for (const page of this.pages) {
      if (!page.contentId) continue;
      const stream = page.commands.join('\n');
      this.setObject(page.contentId, `<< /Length ${byteLength(stream)} >>\nstream\n${stream}\nendstream`);
      const xObjectEntries = [this.logoImageId ? `/Logo ${this.logoImageId} 0 R` : '', ...this.imageXObjects.map((image) => `/${image.name} ${image.id} 0 R`)].filter(Boolean).join(' ');
      const xObjects = xObjectEntries ? `/XObject << ${xObjectEntries} >>` : '';
      this.setObject(page.pageId, `<< /Type /Page /Parent ${this.pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${this.fontRegularId} 0 R /F2 ${this.fontBoldId} 0 R /F3 ${this.fontObliqueId} 0 R >> /ExtGState << /GS1 ${this.watermarkStateId} 0 R /GS2 ${this.panelStateId} 0 R >> ${xObjects} >> /Contents ${page.contentId} 0 R >>`);
    }

    this.setObject(this.pagesId, `<< /Type /Pages /Kids [${this.pages.map((page) => `${page.pageId} 0 R`).join(' ')}] /Count ${this.pages.length} >>`);
    this.setObject(this.catalogId, `<< /Type /Catalog /Pages ${this.pagesId} 0 R >>`);

    const header = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
    const chunks: BlobPart[] = [header];
    const offsets: number[] = [0];
    let offset = byteLength(header);

    this.objects.forEach((object, index) => {
      offsets.push(offset);
      const prefix = `${index + 1} 0 obj\n`;
      const suffix = '\nendobj\n';
      chunks.push(prefix, blobPartForObject(object), suffix);
      offset += byteLength(prefix) + objectByteLength(object) + byteLength(suffix);
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

  private setObject(id: number, value: PdfObjectValue) {
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
    this.renderProposalContent();
  }

  renderProposalContent(options: { sectionTitle?: string } = {}) {
    this.startContentPage();
    if (options.sectionTitle) this.section(options.sectionTitle);
    this.section('EXECUTIVE SUMMARY');
    this.paragraph(buildExecutiveSummary(this.proposal, this.organization), 12);
    this.section('SCOPE OF WORK');
    this.keyValueTable([
      ['Services', buildServiceDescription(this.proposal)],
      ['Site Setup', 'Establish staging area, verify equipment readiness, conduct crew briefing, and implement site controls appropriate to the operating environment.'],
      ['Operations', 'Operations will be conducted in accordance with applicable FAA regulations, the accepted scope of work, and the operator’s documented Safety Management System. Identified hazards and operational controls will be reviewed before work begins.'],
      ['Site Restoration', 'Upon completion, equipment, staging materials, and temporary site controls will be removed and the work area will be returned to its pre-operation condition.'],
      ['Deliverables', buildDeliverables(this.proposal)],
      ['Exclusions', buildExclusions(this.proposal)],
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

  renderCloseoutCover(rows: Array<[string, string]>) {
    this.pageNumber = 1;
    this.watermark(this.currentPage);
    const companyName = companyNameFor(this.organization);
    const logo = this.pdf.getLogo();
    const centerX = PAGE_WIDTH / 2;
    if (logo) this.pdf.drawCircularImage(this.currentPage, centerX, PAGE_HEIGHT - 132, 82);
    else this.pdf.drawWrappedText(this.currentPage, companyName, MARGIN, PAGE_HEIGHT - 118, PAGE_WIDTH - MARGIN * 2, { size: 22, font: 'bold', color: NAVY, align: 'center', lineHeight: 26 });
    this.pdf.drawWrappedText(this.currentPage, 'OPERATIONAL RECORD & CLOSEOUT PACKET', MARGIN + 28, PAGE_HEIGHT - 238, PAGE_WIDTH - (MARGIN + 28) * 2, { size: 22, font: 'bold', color: NAVY, align: 'center', lineHeight: 27 });
    this.pdf.drawWrappedText(this.currentPage, 'DroneSMS Completed Job Record', MARGIN + 28, PAGE_HEIGHT - 272, PAGE_WIDTH - (MARGIN + 28) * 2, { size: 13, font: 'bold', color: BLUE, align: 'center', lineHeight: 16 });
    this.pdf.drawLine(this.currentPage, MARGIN + 82, PAGE_HEIGHT - 302, PAGE_WIDTH - MARGIN - 82, PAGE_HEIGHT - 302, BLUE, 1.1);
    const blockX = MARGIN + 18;
    const blockWidth = PAGE_WIDTH - (MARGIN + 18) * 2;
    const rowHeight = 30;
    const blockHeight = rows.length * rowHeight + 40;
    const startY = PAGE_HEIGHT - 356;
    this.pdf.drawRect(this.currentPage, blockX, startY - blockHeight, blockWidth, blockHeight, { fill: SOFT_PANEL, stroke: LIGHT_GRAY, strokeWidth: 0.45, opacity: 0.5 });
    this.pdf.drawText(this.currentPage, 'COMPLETED PROJECT RECORD', blockX + 24, startY - 24, { size: 8.8, font: 'bold', color: BLUE });
    let rowY = startY - 52;
    rows.forEach(([label, value]) => {
      this.pdf.drawText(this.currentPage, label.toUpperCase(), blockX + 24, rowY, { size: 7.6, font: 'bold', color: GRAY });
      this.pdf.drawWrappedText(this.currentPage, value, blockX + 168, rowY, blockWidth - 196, { size: 9.2, color: NAVY, lineHeight: 11 });
      rowY -= rowHeight;
    });
    this.footer(this.currentPage, this.pageNumber);
  }

  renderTableOfContents(groups: TocGroup[]) {
    this.startContentPage(false);
    this.pdf.drawText(this.currentPage, 'TABLE OF CONTENTS', MARGIN, this.y, { size: 15, font: 'bold', color: NAVY });
    this.pdf.drawLine(this.currentPage, MARGIN, this.y - 8, PAGE_WIDTH - MARGIN, this.y - 8, BLUE, 1.05);
    this.y -= 34;
    groups.filter((group) => group.items.length > 0).forEach((group) => {
      this.ensureSpace(32 + group.items.length * 15);
      this.pdf.drawText(this.currentPage, group.title, MARGIN, this.y, { size: 10.5, font: 'bold', color: BLUE });
      this.y -= 18;
      group.items.forEach((item) => {
        this.pdf.drawText(this.currentPage, '•', MARGIN + 8, this.y, { size: 9.5, color: BLUE, font: 'bold' });
        this.pdf.drawText(this.currentPage, item, MARGIN + 24, this.y, { size: 9.4, color: NAVY });
        this.y -= 15;
      });
      this.y -= 10;
    });
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

    this.pdf.drawWrappedText(this.currentPage, proposalSubtitle(this.proposal), coverTextX, PAGE_HEIGHT - 270, coverTextWidth, { size: 18, font: 'bold', color: NAVY, align: 'center', lineHeight: 22 });
    this.pdf.drawLine(this.currentPage, MARGIN + 96, PAGE_HEIGHT - 332, PAGE_WIDTH - MARGIN - 96, PAGE_HEIGHT - 332, BLUE, 1.1);

    this.coverInfoBlock(PAGE_HEIGHT - 412);
    this.footer(this.currentPage, this.pageNumber);
  }

  startContentPage(showPageNumber = true) {
    this.pageNumber += 1;
    this.currentPage = this.pdf.addPage();
    this.watermark(this.currentPage);
    this.header(this.currentPage);
    this.footer(this.currentPage, showPageNumber ? this.pageNumber : 1);
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

  section(title: string, subtitle?: string) {
    this.ensureSpace(subtitle ? 48 : 34);
    this.pdf.drawText(this.currentPage, title, MARGIN, this.y, { size: 12.5, font: 'bold', color: NAVY });
    this.pdf.drawLine(this.currentPage, MARGIN, this.y - 7, PAGE_WIDTH - MARGIN, this.y - 7, BLUE, 1.05);
    this.y -= 20;
    if (subtitle) this.y = this.pdf.drawWrappedText(this.currentPage, subtitle, MARGIN, this.y, PAGE_WIDTH - MARGIN * 2, { size: 8.6, font: 'oblique', color: GRAY, lineHeight: 11 }) - 3;
  }

  paragraph(text: string, spacing = 16) {
    const paragraphs = text.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
    if (paragraphs.length === 0) return;

    paragraphs.forEach((paragraph, index) => {
      this.ensureSpace(80);
      const paragraphGap = index < paragraphs.length - 1 ? 7 : spacing;
      this.y = this.pdf.drawWrappedText(this.currentPage, paragraph, MARGIN, this.y, PAGE_WIDTH - MARGIN * 2, { size: 9.6, color: NAVY, lineHeight: 12.8 }) - paragraphGap;
    });
  }

  bullets(items: string[]) {
    for (const item of items) {
      this.ensureSpace(21);
      this.pdf.drawText(this.currentPage, '•', MARGIN + 5, this.y, { size: 9.5, color: BLUE, font: 'bold' });
      this.y = this.pdf.drawWrappedText(this.currentPage, item, MARGIN + 18, this.y, PAGE_WIDTH - MARGIN * 2 - 18, { size: 9.4, color: NAVY, lineHeight: 12.4 }) - 3;
    }
    this.y -= 6;
  }

  keyValueTable(rows: Array<[string, string]>) {
    this.table([['Item', 'Details'], ...rows], [155, 332]);
  }

  table(rows: TableCell[][], columnWidths: number[], options: TableOptions = {}) {
    const columns = rows[0].map((header, index) => ({ header: String(header ?? ''), width: columnWidths[index] ?? 100 }));
    this.drawTable(columns, rows.slice(1), options);
  }

  imageDocumentPage(title: string, rows: Array<[string, string]>, image: PdfImage) {
    this.startContentPage();
    this.section(title);
    this.keyValueTable(rows);
    const maxWidth = PAGE_WIDTH - MARGIN * 2;
    const maxHeight = Math.max(120, this.y - 44);
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    const x = MARGIN + (maxWidth - width) / 2;
    const y = Math.max(44, this.y - height);
    const imageName = this.pdf.addJpegImage(image);
    this.pdf.drawNamedImage(this.currentPage, imageName, x, y, width, height);
    this.y = y - 14;
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

  ensureSpace(required: number) {
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
  const fileName = buildProposalPdfFileName(proposal, proposal.user_id);
  const displayFileName = buildProposalPdfDisplayFileName(proposal);
  downloadBlob(blob, displayFileName);

  try {
    await retainProposalPdf(blob, fileName, displayFileName, proposal);
    return { saved: true };
  } catch (error) {
    console.error('Unable to save proposal PDF to DroneSMS records.', error);
    return { saved: false, error };
  }
}



type JobPacketRecord = {
  id: string; organization_id: string; user_id: string | null; name: string; service_type: string | null; location: string | null; planned_date: string | null; status: string | null; source_proposal_id: string | null; source_proposal_number: string | null; client_name?: string | null; site_address?: string | null;
};

type JobPacketPersonnelAssignment = { assigned_role: string | null; personnel: { full_name: string | null; role: string | null; part_107_expiration_date: string | null; training_expiration_date: string | null; status: string | null } | null };
type JobPacketEquipmentReferenceDocument = { document_type: string; file_name: string | null; display_file_name: string | null; storage_path: string | null; mime_type: string | null; created_at: string | null };
type JobPacketEquipmentAssignment = { equipment: { name: string | null; equipment_type: string | null; status: string | null; make?: string | null; product_category?: string | null; typical_mix_ratio?: string | null; application_notes?: string | null; equipment_reference_documents?: JobPacketEquipmentReferenceDocument[] } | null };
type JobPacketSafetyEvent = { category: string | null; description: string | null; immediate_actions_taken: string | null; outcome: string | null; created_at: string | null };
type JobPacketJha = { status: string | null; faa_airspace_class: string | null; laanc_required: string | null; crew_briefed: boolean | null; controls_in_place: boolean | null; certified_at: string | null; hazard_entries: unknown; runoff_risk: boolean | null; containment_plan: string | null; water_body_proximity: boolean | null; secondary_containment_in_place: boolean | null; reclamation_method: string | null; reclamation_volume_estimate: number | string | null; disposal_vendor_name_contact: string | null; water_body_distance: number | string | null; water_body_type: string | null };
type JobPacketPreflight = Record<string, boolean | string | null> & { status: string | null; notes?: string | null; final_rpic_approval?: boolean | null };
type JobPacketCloseout = { operation_result: string | null; deviation_narrative: string | null; updated_at: string | null };
type JobPacketPhoto = { id: string; hazard_id: string | null; hazard_name: string | null; photo_url: string; caption: string | null; include_in_packet: boolean; created_at: string | null; category?: string | null };

export async function generateJobPacketPdf(jobId: string) {
  const packet = await loadJobPacketForPdf(jobId);
  const organization = await loadOrganizationSettingsById(packet.job.organization_id);
  const logo = await loadLogoImage(organization);
  const pdf = new PdfBuilder(logo);
  const proposal = packet.proposal ?? buildPacketPlaceholderProposal(packet.job);
  const renderer = new ProposalPdfRenderer(pdf, proposal, organization);
  const packetPhotos = await loadPacketPhotoImages(packet.photos);
  const toc = buildCloseoutTableOfContents(packet, packetPhotos);

  renderer.renderCloseoutCover(buildCloseoutCoverRows(packet, proposal, organization));
  renderer.renderTableOfContents(toc);
  renderer.renderProposalContent({ sectionTitle: 'PROPOSAL DOCUMENTATION' });

  renderer.section('OPERATIONAL RECORD');
  renderer.section('JOB INFORMATION');
  renderer.keyValueTable([
    ['Job Name', clean(packet.job.name)],
    ['Client', clean(packet.job.client_name) || clean(packet.proposal?.client_name) || PLACEHOLDER],
    ['Service Type', clean(packet.job.service_type) || PLACEHOLDER],
    ['Site Address', clean(packet.job.site_address) || clean(packet.job.location) || clean(packet.proposal?.site_address) || PLACEHOLDER],
    ['Planned Date', formatDate(packet.job.planned_date) || 'Not scheduled'],
    ['Actual / Completion Date', formatDate(packet.closeout?.updated_at) || 'Not recorded'],
    ['Job Status', clean(packet.job.status) || PLACEHOLDER],
    ['Result', clean(packet.closeout?.operation_result) || 'Not recorded'],
  ]);
  renderer.section('CREW ASSIGNMENT');
  renderer.table([['Role', 'Crew Member'], ...(packet.assignments.length ? packet.assignments.map((a) => [clean(a.assigned_role) || clean(a.personnel?.role) || 'Crew', clean(a.personnel?.full_name) || 'Personnel record unavailable']) : [['Not assigned', 'No crew assigned.']])], [170, 317]);
  renderer.section('EQUIPMENT ASSIGNMENT');
  renderer.table([['Equipment', 'Type / Purpose'], ...(packet.equipmentAssignments.length ? packet.equipmentAssignments.map((a) => [clean(a.equipment?.name) || 'Equipment record unavailable', clean(a.equipment?.equipment_type) || 'Unknown type']) : [['Not assigned', 'Equipment was not assigned in the job record.']])], [220, 267]);
  renderer.section('JHA SUMMARY');
  renderJhaSummary(renderer, pdf, packet.jha, packetPhotos);
  renderer.section('AIRSPACE REVIEW');
  renderer.keyValueTable([['Airspace Class', clean(packet.jha?.faa_airspace_class) || PLACEHOLDER], ['Nearby Airport', PLACEHOLDER], ['LAANC Required', clean(packet.jha?.laanc_required) || PLACEHOLDER], ['Operational Finding', packet.jha ? `JHA status: ${clean(packet.jha.status) || 'Draft'}. Controls in place: ${packet.jha.controls_in_place ? 'Yes' : 'No'}.` : 'Airspace review not started.']]);
  const documentationPhotos = packetPhotos.filter((photo) => !photo.hazardId);
  if (documentationPhotos.length) renderPhotoDocumentation(renderer, pdf, documentationPhotos);
  renderer.section('PREFLIGHT CHECKLIST');
  renderer.table([['Checklist Item', 'State'], ...buildPreflightRows(packet.preflight)], [300, 187]);
  renderer.section('SAFETY EVENTS');
  renderer.table([['Category', 'Outcome', 'Details'], ...(packet.safetyEvents.length ? packet.safetyEvents.map((e) => [clean(e.category) || 'Safety Event', clean(e.outcome) || 'Recorded', `${clean(e.description) || 'No description.'}${e.immediate_actions_taken ? ` Immediate actions: ${e.immediate_actions_taken}` : ''}`]) : [['None', 'None', 'No safety events recorded.']])], [95, 105, 287]);
  const environmentalRows = buildEnvironmentalRows(packet.jha);
  if (environmentalRows.length) { renderer.section('ENVIRONMENTAL CONTROLS'); renderer.keyValueTable(environmentalRows); }
  renderer.section('CLOSEOUT SUMMARY');
  renderer.keyValueTable([['Operation Result', clean(packet.closeout?.operation_result) || 'Not completed'], ['Closeout Narrative', clean(packet.closeout?.deviation_narrative) || 'No closeout narrative was provided.'], ['Completion Date', formatDate(packet.closeout?.updated_at) || 'Not recorded']]);
  renderer.section('PERSONNEL QUALIFICATION SUMMARY');
  renderer.table([['Name', 'Role', 'Part 107', 'Training', 'Status'], ...(packet.assignments.length ? packet.assignments.map((a) => [clean(a.personnel?.full_name) || 'Unavailable', clean(a.assigned_role) || clean(a.personnel?.role) || 'Crew', formatDate(a.personnel?.part_107_expiration_date) || 'Not tracked', formatDate(a.personnel?.training_expiration_date) || 'Not tracked', clean(a.personnel?.status) || 'Missing']) : [['No assigned crew', '-', '-', '-', '-']])], [130, 85, 88, 88, 96]);
  if (packet.documents.length) { renderer.section('GENERATED DOCUMENTS / ATTACHMENTS SUMMARY'); renderer.bullets(packet.documents.map((d) => `${getPacketDocumentLabel(d.document_type)} - ${d.display_file_name || d.file_name || 'Generated document'}`)); }
  await renderChemicalReferenceAppendix(renderer, packet.equipmentAssignments, pdf);

  const blob = pdf.save();
  const fileName = buildJobPacketStorageFileName(packet.job, await getGeneratedDocumentUserId());
  const displayFileName = buildJobPacketDisplayFileName(packet.job);
  downloadBlob(blob, displayFileName);
  try {
    await saveGeneratedDocument({ blob, organizationId: packet.job.organization_id, documentType: 'job_packet_pdf', recordType: 'job', recordId: packet.job.id, generatedByUserId: await getGeneratedDocumentUserId(), fileName, displayFileName, storagePath: `job/${packet.job.id}/${fileName}` });
    return { saved: true };
  } catch (error) { console.error('Unable to save job packet PDF to DroneSMS records.', error); return { saved: false, error }; }
}

async function loadJobPacketForPdf(jobId: string) {
  const [jobResult, assignmentsResult, equipmentResult, safetyResult, jhaResult, preflightResult, closeoutResult, documentsResult, photosResult] = await Promise.all([
    supabase.from('jobs').select('id, organization_id, user_id, name, service_type, location, planned_date, status, source_proposal_id, source_proposal_number, client_name, site_address').eq('id', jobId).single(),
    supabase.from('job_personnel').select('assigned_role, personnel:personnel_id(full_name, role, part_107_expiration_date, training_expiration_date, status)').eq('job_id', jobId).order('created_at', { ascending: true }),
    supabase.from('job_equipment').select('equipment:equipment_id(name, equipment_type, status, make, product_category, typical_mix_ratio, application_notes, equipment_reference_documents(document_type, file_name, display_file_name, storage_path, mime_type, created_at))').eq('job_id', jobId).order('created_at', { ascending: true }),
    supabase.from('job_safety_events').select('category, description, immediate_actions_taken, outcome, created_at').eq('job_id', jobId).order('created_at', { ascending: false }),
    supabase.from('jha_assessments').select('status, faa_airspace_class, laanc_required, crew_briefed, controls_in_place, certified_at, hazard_entries, runoff_risk, containment_plan, water_body_proximity, secondary_containment_in_place, reclamation_method, reclamation_volume_estimate, disposal_vendor_name_contact, water_body_distance, water_body_type').eq('job_id', jobId).maybeSingle(),
    supabase.from('preflight_checklists').select('*').eq('job_id', jobId).maybeSingle(),
    supabase.from('job_operation_closeouts').select('operation_result, deviation_narrative, updated_at').eq('job_id', jobId).maybeSingle(),
    supabase.from('generated_documents').select('document_type, file_name, display_file_name').eq('record_type', 'job').eq('record_id', jobId).is('archived_at', null).neq('document_type', 'job_packet_pdf').order('generated_at', { ascending: false }),
    supabase.from('job_hazard_photos').select('id, hazard_id, hazard_name, photo_url, caption, include_in_packet, created_at').eq('job_id', jobId).eq('include_in_packet', true).is('deleted_at', null).order('created_at', { ascending: true }),
  ]);
  if (jobResult.error) throw jobResult.error; if (assignmentsResult.error) throw assignmentsResult.error; if (equipmentResult.error) throw equipmentResult.error; if (safetyResult.error) throw safetyResult.error; if (jhaResult.error) throw jhaResult.error; if (preflightResult.error) throw preflightResult.error; if (closeoutResult.error) throw closeoutResult.error; if (documentsResult.error) throw documentsResult.error; if (photosResult.error) throw photosResult.error;
  const job = jobResult.data as JobPacketRecord;
  const proposal = job.source_proposal_id ? await loadProposalForPdf(job.source_proposal_id).catch(() => null) : null;
  return { job, proposal, assignments: (assignmentsResult.data ?? []) as unknown as JobPacketPersonnelAssignment[], equipmentAssignments: (equipmentResult.data ?? []) as unknown as JobPacketEquipmentAssignment[], safetyEvents: (safetyResult.data ?? []) as JobPacketSafetyEvent[], jha: jhaResult.data as JobPacketJha | null, preflight: preflightResult.data as JobPacketPreflight | null, closeout: closeoutResult.data as JobPacketCloseout | null, documents: (documentsResult.data ?? []) as Array<{document_type: string; file_name: string | null; display_file_name: string | null}>, photos: (photosResult.data ?? []) as JobPacketPhoto[] };
}


async function renderChemicalReferenceAppendix(renderer: ProposalPdfRenderer, assignments: JobPacketEquipmentAssignment[], pdf: PdfBuilder) {
  const documentOrder = ['Safety Data Sheet (SDS)', 'Product Label', 'Technical Data Sheet (TDS)'];
  const documentLabel: Record<string, string> = { 'Safety Data Sheet (SDS)': 'SDS', 'Product Label': 'Product Label', 'Technical Data Sheet (TDS)': 'TDS' };
  const materials = assignments
    .map((assignment) => assignment.equipment)
    .filter((equipment): equipment is NonNullable<JobPacketEquipmentAssignment['equipment']> => equipment?.equipment_type === 'Chemical / Material')
    .map((equipment) => ({
      ...equipment,
      equipment_reference_documents: [...(equipment.equipment_reference_documents ?? [])]
        .sort((left, right) => {
          const leftOrder = documentOrder.includes(left.document_type) ? documentOrder.indexOf(left.document_type) : documentOrder.length;
          const rightOrder = documentOrder.includes(right.document_type) ? documentOrder.indexOf(right.document_type) : documentOrder.length;
          return leftOrder - rightOrder;
        }),
    }))
    .filter((equipment) => equipment.equipment_reference_documents.length > 0);

  if (!materials.length) return;

  renderer.section('CHEMICAL DOCUMENTATION');
  renderer.table(
    [
      ['Product', 'Manufacturer', 'Documents Included'],
      ...materials.map((equipment) => [
        clean(equipment.name) || 'Chemical / Material',
        clean(equipment.make) || 'Not recorded',
        equipment.equipment_reference_documents.map((document) => documentLabel[document.document_type] ?? document.document_type).join(', '),
      ]),
    ],
    [170, 145, 172],
  );

  for (const equipment of materials) {
    for (const document of equipment.equipment_reference_documents) {
      const titleRows: Array<[string, string]> = [
        ['Product Name', clean(equipment.name) || 'Not recorded'],
        ['Manufacturer', clean(equipment.make) || 'Not recorded'],
        ['Document Type', document.document_type],
      ];
      const fileName = clean(document.display_file_name) || clean(document.file_name);
      if (fileName) titleRows.push(['Source Filename', fileName]);

      try {
        const bytes = await downloadEquipmentReferenceDocument(document.storage_path);
        if (isPdfDocument(document, bytes)) {
          renderer.startContentPage();
          renderer.section('CHEMICAL DOCUMENTATION');
          renderer.keyValueTable(titleRows);
          pdf.appendPdfPages(bytes);
          continue;
        }

        const image = await decodeReferenceImage(bytes, document.mime_type, fileName);
        if (image) {
          renderer.imageDocumentPage('CHEMICAL DOCUMENTATION', titleRows, image);
          continue;
        }

        throw new Error('Unsupported reference document format.');
      } catch (error) {
        console.error('Reference document could not be embedded.', { product: equipment.name, documentType: document.document_type, error });
        renderer.startContentPage();
        renderer.section('CHEMICAL DOCUMENTATION');
        renderer.keyValueTable([...titleRows, ['Embedding Status', 'Reference document could not be embedded.']]);
      }
    }
  }
}

async function downloadEquipmentReferenceDocument(storagePath: string | null) {
  if (!storagePath) throw new Error('Missing equipment reference document storage path.');
  const { data, error } = await supabase.storage.from('equipment-reference-documents').download(storagePath);
  if (error) throw error;
  if (!data) throw new Error('Equipment reference document download returned no data.');
  return new Uint8Array(await data.arrayBuffer());
}

function isPdfDocument(document: JobPacketEquipmentReferenceDocument, bytes: Uint8Array) {
  const mimeType = document.mime_type?.toLowerCase() ?? '';
  const fileName = `${document.display_file_name ?? ''} ${document.file_name ?? ''}`.toLowerCase();
  return mimeType.includes('pdf') || fileName.includes('.pdf') || bytesToBinaryString(bytes.slice(0, 5)) === '%PDF-';
}

async function decodeReferenceImage(bytes: Uint8Array, mimeType: string | null, fileName: string) {
  const jpegDimensions = readJpegDimensions(bytes);
  if (jpegDimensions) return { ...jpegDimensions, bytes };

  const normalizedMimeType = mimeType || (fileName.toLowerCase().endsWith('.png') ? 'image/png' : fileName.toLowerCase().endsWith('.webp') ? 'image/webp' : '');
  if (!normalizedMimeType.startsWith('image/')) return null;

  const blob = new Blob([new Uint8Array(bytes)], { type: normalizedMimeType });
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const jpegBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  if (!jpegBlob) return null;
  const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
  const dimensions = readJpegDimensions(jpegBytes);
  return dimensions ? { ...dimensions, bytes: jpegBytes } : null;
}

function buildCloseoutCoverRows(packet: Awaited<ReturnType<typeof loadJobPacketForPdf>>, proposal: ProposalPdfRecord, organization: OrganizationSettings | null): Array<[string, string]> {
  return [
    ['Project / Job Name', clean(packet.job.name)],
    ['Client', clean(packet.job.client_name) || clean(proposal.client_name)],
    ['Site / Property Address', clean(packet.job.site_address) || clean(packet.job.location) || clean(proposal.site_address)],
    ['Service Type', clean(packet.job.service_type) || clean(proposal.service_type)],
    ['Proposal Number', clean(proposal.proposal_number) || clean(packet.job.source_proposal_number)],
    ['Planned Date', formatDate(packet.job.planned_date)],
    ['Completion Date', formatDate(packet.closeout?.updated_at)],
    ['Prepared By / Operator', preparedByDisplay(proposal, organization)],
    ['Generated Date', formatDate(new Date().toISOString())],
  ].filter((row): row is [string, string] => Boolean(row[1]));
}

function getJobHazardEntries(jha: JobPacketJha | null) {
  return Array.isArray(jha?.hazard_entries) ? (jha.hazard_entries as Array<Record<string, unknown>>) : [];
}

async function loadPacketPhotoImages(photos: JobPacketPhoto[]): Promise<PacketPhotoImage[]> {
  const loaded = await Promise.all(photos.map(async (photo) => {
    try {
      const { data } = await supabase.storage.from('job-evidence-photos').createSignedUrl(photo.photo_url, 60 * 60);
      const response = await fetch(data?.signedUrl ?? supabase.storage.from('job-evidence-photos').getPublicUrl(photo.photo_url).data.publicUrl);
      if (!response.ok) return null;
      const bytes = new Uint8Array(await response.arrayBuffer());
      const dimensions = readJpegDimensions(bytes);
      if (!dimensions) return null;
      return { ...dimensions, bytes, id: photo.id, caption: photo.caption, timestamp: photo.created_at, hazardId: photo.hazard_id, hazardName: photo.hazard_name, photoUrl: photo.photo_url, category: photo.category ?? null };
    } catch (error) {
      console.warn('Unable to load packet evidence photo.', error);
      return null;
    }
  }));
  return loaded.filter(Boolean) as PacketPhotoImage[];
}

function readJpegDimensions(bytes: Uint8Array): Pick<PdfImage, 'width' | 'height'> | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    const length = (bytes[offset + 2] << 8) + bytes[offset + 3];
    if (marker >= 0xc0 && marker <= 0xc3) return { height: (bytes[offset + 5] << 8) + bytes[offset + 6], width: (bytes[offset + 7] << 8) + bytes[offset + 8] };
    offset += 2 + length;
  }
  return null;
}

function buildCloseoutTableOfContents(packet: Awaited<ReturnType<typeof loadJobPacketForPdf>>, photos: PacketPhotoImage[]): TocGroup[] {
  const environmentalRows = buildEnvironmentalRows(packet.jha);
  return [
    { title: 'PROPOSAL DOCUMENTATION', items: ['Executive Summary', 'Scope of Work', 'Personnel', 'Equipment', 'Preliminary Hazard Assessment', 'Airspace Review', 'Pricing', 'Acceptance'] },
    { title: 'OPERATIONAL RECORD', items: ['Job Information', 'Crew Assignment', 'Equipment Assignment', ...(getJobHazardEntries(packet.jha).length ? ['JHA Summary'] : [])] },
    { title: 'CONTROL VERIFICATION', items: photos.some((photo) => photo.hazardId) ? ['Hazard Mitigation Verification'] : [] },
    { title: 'OPERATIONAL EVIDENCE', items: photos.some((photo) => !photo.hazardId) ? ['Photo Documentation'] : [] },
    { title: 'COMPLIANCE RECORDS', items: [...(environmentalRows.length ? ['Environmental Controls'] : []), 'Preflight Checklist', 'Safety Events'] },
    { title: 'CLOSEOUT', items: ['Closeout Summary', 'Personnel Qualification Summary', ...(packet.equipmentAssignments.some((assignment) => assignment.equipment?.equipment_type === 'Chemical / Material' && assignment.equipment.equipment_reference_documents?.some((document) => document.document_type === 'Safety Data Sheet (SDS)')) ? ['Chemical Documentation'] : [])] },
  ];
}

function renderJhaSummary(renderer: ProposalPdfRenderer, pdf: PdfBuilder, jha: JobPacketJha | null, photos: PacketPhotoImage[]) {
  const entries = getJobHazardEntries(jha);
  if (!entries.length) {
    renderer.table([['Hazard', 'Category', 'Mitigation'], ['No hazards documented', 'Not recorded', 'No JHA hazards or mitigations were documented.']], [165, 95, 227]);
    return;
  }
  entries.forEach((entry, index) => {
    const hazardId = clean(String(entry.id ?? ''));
    const hazardName = clean(String(entry.description ?? entry.hazard ?? '')) || `Hazard ${index + 1}`;
    renderer.table([['Hazard', 'Category', 'Mitigation'], [hazardName, clean(String(entry.category ?? entry.owner ?? '')) || 'Operational', clean(String(entry.mitigation ?? entry.controls ?? '')) || 'Mitigation not recorded.']], [165, 95, 227]);
    const hazardPhotos = photos.filter((photo) => photo.hazardId === hazardId || (!photo.hazardId && false));
    if (hazardPhotos.length) renderPhotoGrid(renderer, pdf, 'Verification Photos', hazardPhotos);
  });
}

function renderPhotoDocumentation(renderer: ProposalPdfRenderer, pdf: PdfBuilder, photos: PacketPhotoImage[]) {
  renderer.section('PHOTO DOCUMENTATION');
  renderPhotoGrid(renderer, pdf, 'General Documentation', photos);
}

function renderPhotoGrid(renderer: ProposalPdfRenderer, pdf: PdfBuilder, title: string, photos: PacketPhotoImage[]) {
  renderer.ensureSpace(34);
  (pdf as any).drawText((renderer as any).currentPage, title, MARGIN, (renderer as any).y, { size: 10, font: 'bold', color: BLUE });
  (renderer as any).y -= 18;
  photos.forEach((photo) => {
    renderer.ensureSpace(190);
    const imageName = pdf.addJpegImage(photo);
    const maxWidth = PAGE_WIDTH - MARGIN * 2;
    const maxHeight = 140;
    const ratio = Math.min(maxWidth / photo.width, maxHeight / photo.height);
    const width = photo.width * ratio;
    const height = photo.height * ratio;
    const page = (renderer as any).currentPage as PageState;
    const y = (renderer as any).y - height;
    pdf.drawNamedImage(page, imageName, MARGIN, y, width, height);
    (renderer as any).y = y - 12;
    const caption = clean(photo.caption) || 'Operational evidence photo.';
    (renderer as any).y = pdf.drawWrappedText(page, caption, MARGIN, (renderer as any).y, maxWidth, { size: 8.8, color: NAVY, lineHeight: 11 }) - 2;
    const timestamp = formatPhotoTimestamp(photo.timestamp);
    if (timestamp) (renderer as any).y = pdf.drawWrappedText(page, timestamp, MARGIN, (renderer as any).y, maxWidth, { size: 8, color: GRAY, lineHeight: 10 }) - 10;
  });
}

function formatPhotoTimestamp(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date).replace(',', '');
}


function buildPreflightRows(preflight: JobPacketPreflight | null) {
  if (!preflight) return [['Status', 'Preflight checklist not started.']];
  const labels: Record<string, string> = { aircraft_selected: 'Aircraft selected', battery_condition_checked: 'Battery condition checked', propellers_inspected: 'Propellers inspected', firmware_app_status_checked: 'Firmware/app status checked', gps_signal_confirmed: 'GPS signal confirmed', home_point_verified: 'Home point verified', storage_media_checked: 'Storage media checked', weather_verified: 'Weather verified', wind_conditions_acceptable: 'Wind conditions acceptable', airspace_reviewed: 'Airspace reviewed', laanc_confirmed_if_required: 'LAANC confirmed if required', notam_tfr_checked: 'NOTAM/TFR checked', visual_observer_assigned_if_needed: 'Visual observer assigned if needed', emergency_procedures_reviewed: 'Emergency procedures reviewed', crew_communications_confirmed: 'Crew communications confirmed', final_rpic_approval: 'Final RPIC approval' };
  return [['Status', clean(preflight.status) || 'Draft'], ...Object.entries(labels).map(([key, label]) => [label, preflight[key] ? 'Complete' : 'Open'])];
}

function buildEnvironmentalRows(jha: JobPacketJha | null): Array<[string, string]> {
  if (!jha || (!jha.runoff_risk && !jha.water_body_proximity && !clean(jha.containment_plan))) return [];
  return [['Runoff Planning', jha.runoff_risk ? 'Documented as applicable' : 'Not marked applicable'], ['Containment Plan', clean(jha.containment_plan) || 'Not recorded'], ['Water Body Proximity', jha.water_body_proximity ? `Yes${jha.water_body_distance ? ` - ${jha.water_body_distance} feet` : ''}${jha.water_body_type ? ` (${jha.water_body_type})` : ''}` : 'Not marked applicable'], ['Secondary Containment', jha.secondary_containment_in_place ? 'In place' : 'Not recorded'], ['Reclamation Method', clean(jha.reclamation_method) || 'Not recorded'], ['Estimated Volume', jha.reclamation_volume_estimate ? `${jha.reclamation_volume_estimate} gallons` : 'Not recorded'], ['Vendor / Contact', clean(jha.disposal_vendor_name_contact) || 'Not recorded']];
}

function buildPacketPlaceholderProposal(job: JobPacketRecord): ProposalPdfRecord { return { id: job.source_proposal_id ?? job.id, organization_id: job.organization_id, user_id: job.user_id ?? '', proposal_number: job.source_proposal_number, proposal_name: job.name, client_name: job.client_name ?? null, contact_name: null, phone: null, email: null, service_type: job.service_type, site_address: job.site_address ?? job.location, description: null, deliverables: null, exclusions: null, proposed_rpic: null, proposed_crew: null, proposed_aircraft: null, proposed_rpic_name: null, proposed_rpic_credentials: null, proposed_rpic_bio: null, airspace_class: null, laanc_required: null, additional_authorization_required: null, hazard: null, proposed_mitigation: null, hazard_assessment: [], proposal_equipment: [], proposal_amount: null, valid_until: null, created_at: null }; }
function buildJobPacketStorageFileName(job: JobPacketRecord, userId: string) { const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z'); return `job_packet_pdf-user_${sanitizeFileName(userId)}-${timestamp}-${crypto.randomUUID()}-${sanitizeFileName(job.name)}.pdf`; }
function buildJobPacketDisplayFileName(job: JobPacketRecord) { const jobNumber = clean(job.source_proposal_number); const jobName = sanitizeFileName(job.name).replace(/-/g, ' '); return jobNumber ? `JOB-${jobNumber} - ${jobName} - Closeout Packet.pdf` : `${jobName} - Closeout Packet.pdf`; }
function getPacketDocumentLabel(type: string) { return type === 'proposal_pdf' ? 'Proposal PDF' : type === 'job_packet_pdf' ? 'Job Packet PDF' : type.replace(/_/g, ' '); }

async function getGeneratedDocumentUserId() {
  const { data: sessionData } = await supabase.auth.getSession();
  const sessionUserId = sessionData.session?.user.id;
  if (sessionUserId) return sessionUserId;

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) {
    throw new Error('You must be signed in to save proposal documents.');
  }
  return userId;
}

function buildProposalPdfFileName(proposal: ProposalPdfRecord, userId: string) {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
  const randomId = crypto.randomUUID();
  return `proposal_pdf-user_${sanitizeFileName(userId)}-${timestamp}-${randomId}-${sanitizeFileName(proposalNumber(proposal))}.pdf`;
}

function buildProposalPdfDisplayFileName(proposal: ProposalPdfRecord) {
  const number = sanitizeFileName(proposalNumber(proposal));
  const client = sanitizeFileName(proposal.client_name ?? '');
  return client ? `${number} - ${client}.pdf` : `${number}.pdf`;
}

async function retainProposalPdf(
  blob: Blob,
  fileName: string,
  displayFileName: string,
  proposal: ProposalPdfRecord,
) {
  await saveGeneratedDocument({
    blob,
    organizationId: proposal.organization_id,
    documentType: 'proposal_pdf',
    recordType: 'proposal',
    recordId: proposal.id,
    generatedByUserId: await getGeneratedDocumentUserId(),
    fileName,
    displayFileName,
    storagePath: `proposal/${proposal.id}/${fileName}`,
  });
}

async function loadProposalForPdf(proposalId: string) {
  const { data, error } = await supabase
    .from('proposals')
    .select('id, organization_id, user_id, proposal_number, proposal_name, client_name, contact_name, phone, email, service_type, site_address, description, deliverables, exclusions, proposed_rpic, proposed_crew, proposed_aircraft, proposed_rpic_name, proposed_rpic_credentials, proposed_rpic_bio, airspace_class, laanc_required, additional_authorization_required, hazard, proposed_mitigation, hazard_assessment, proposal_equipment, proposal_amount, valid_until, created_at')
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

function buildDeliverables(proposal: ProposalPdfRecord) {
  return clean(proposal.deliverables) || getProposalScopeDefaults(proposal.service_type).deliverables;
}

function buildExclusions(proposal: ProposalPdfRecord) {
  return clean(proposal.exclusions) || getProposalScopeDefaults(proposal.service_type).exclusions;
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
  return formatProposalDate(value, { month: '2-digit', day: '2-digit', year: 'numeric' });
}

function formatLongDate(value: string | null | undefined) {
  return formatProposalDate(value, { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatProposalDate(value: string | null | undefined, options: Intl.DateTimeFormatOptions) {
  if (!value) return '';
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);

  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]);
    const day = Number(dateOnly[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (Number.isNaN(date.getTime())) return value.slice(0, 10);
    return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(date);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat('en-US', options).format(date);
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

function objectByteLength(value: PdfObjectValue) {
  return typeof value === 'string' ? byteLength(value) : value.byteLength;
}

function blobPartForObject(value: PdfObjectValue): BlobPart {
  if (typeof value === 'string') return value;
  return value.buffer instanceof ArrayBuffer ? value as Uint8Array<ArrayBuffer> : new Uint8Array(value);
}

function bytesToBinaryString(bytes: Uint8Array) {
  let output = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    output += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return output;
}

function binaryStringToBytes(value: string) {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) bytes[index] = value.charCodeAt(index) & 0xff;
  return bytes;
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
