/**
 * File purpose: Provides generated documents domain utilities and service adapters shared by the application.
 * Fallback/error behavior: optional data uses module-defined defaults; service and browser failures are surfaced to callers or page error state.
 * Known issues: see docs/documentation.md for audit findings that affect this module or its verification path.
 */
import { supabase } from '@frontend/lib/supabase';

export const generatedDocumentsBucket = 'generated-documents';

/**
 * Purpose: Defines the generated document type data contract used by the generated documents module.
 * Fallback/error behavior: This declaration is compile-time only; nullable and optional fields are handled by the owning loader, normalizer, or UI fallback.
 * Known limitation: TypeScript does not generate runtime validation from this declaration, so untrusted service data still requires explicit normalization.
 */
export type GeneratedDocumentType =
  | 'proposal_pdf'
  | 'job_packet_pdf'
  | 'completion_report_pdf'
  | 'incident_report_pdf'
  | 'safety_export_pdf'
  | 'airspace_package_pdf'
  | 'preflight_packet_pdf'
  | 'jha_packet_pdf';

/**
 * Purpose: Defines the generated document record type data contract used by the generated documents module.
 * Fallback/error behavior: This declaration is compile-time only; nullable and optional fields are handled by the owning loader, normalizer, or UI fallback.
 * Known limitation: TypeScript does not generate runtime validation from this declaration, so untrusted service data still requires explicit normalization.
 */
export type GeneratedDocumentRecordType =
  | 'proposal'
  | 'job'
  | 'incident'
  | 'organization';

/**
 * Purpose: Represents generated document record data read, written, or rendered by the generated documents workflow.
 * Fallback/error behavior: This declaration is compile-time only; nullable and optional fields are handled by the owning loader, normalizer, or UI fallback.
 * Known limitation: TypeScript does not generate runtime validation from this declaration, so untrusted service data still requires explicit normalization.
 */
export type GeneratedDocumentRecord = {
  id: string;
  organization_id: string;
  document_type: GeneratedDocumentType;
  record_type: GeneratedDocumentRecordType;
  record_id: string;
  generated_by_user_id: string | null;
  archived_at: string | null;
  archived_by_user_id: string | null;
  file_name: string | null;
  display_file_name: string | null;
  storage_path: string;
  file_size: number | null;
  generated_at: string;
  created_at: string;
};

/**
 * Purpose: Maps document type labels values to the canonical metadata consumed by generated documents.
 * Fallback/error behavior: Empty or missing collections use the owning workflow default; external persisted values are normalized by the consuming function where supported.
 * Known limitation: Persisted values outside this structure may require legacy normalization before they can be selected or displayed.
 */
const documentTypeLabels: Record<GeneratedDocumentType, string> = {
  proposal_pdf: 'Proposal PDF',
  job_packet_pdf: 'Job Packet PDF',
  completion_report_pdf: 'Completion Report PDF',
  incident_report_pdf: 'Incident Report PDF',
  safety_export_pdf: 'Safety Export PDF',
  airspace_package_pdf: 'Airspace Package PDF',
  preflight_packet_pdf: 'Preflight Packet PDF',
  jha_packet_pdf: 'JHA Packet PDF',
};

/**
 * Computes get generated document type label for the surrounding workflow.
 * Fallback/error behavior: Missing optional input uses the defaults defined in the function; unexpected input or runtime failures propagate unless explicitly normalized.
 */
export function getGeneratedDocumentTypeLabel(type: GeneratedDocumentType) {
  return documentTypeLabels[type] ?? type.replace(/_/g, ' ');
}

/**
 * Computes format file size for the surrounding workflow.
 * Fallback/error behavior: Missing optional input uses the defaults defined in the function; unexpected input or runtime failures propagate unless explicitly normalized.
 */
export function formatFileSize(bytes: number | null | undefined) {
  if (!bytes || bytes < 0) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let size = bytes / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

/**
 * Purpose: Defines the load generated documents input data contract used by the generated documents module.
 * Fallback/error behavior: This declaration is compile-time only; nullable and optional fields are handled by the owning loader, normalizer, or UI fallback.
 * Known limitation: TypeScript does not generate runtime validation from this declaration, so untrusted service data still requires explicit normalization.
 */
type LoadGeneratedDocumentsInput = {
  recordType: GeneratedDocumentRecordType;
  recordIds: string[];
  documentType?: GeneratedDocumentType;
  includeArchived?: boolean;
};

/**
 * Performs load generated documents for the surrounding workflow.
 * Fallback/error behavior: Service, storage, browser, or authentication failures are returned or thrown to the caller for user-visible handling.
 */
export async function loadGeneratedDocuments({
  recordType,
  recordIds,
  documentType,
  includeArchived = false,
}: LoadGeneratedDocumentsInput) {
  if (recordIds.length === 0) return [];

  let query = supabase
    .from('generated_documents')
    .select(
      'id, organization_id, document_type, record_type, record_id, generated_by_user_id, archived_at, archived_by_user_id, file_name, display_file_name, storage_path, file_size, generated_at, created_at',
    )
    .eq('record_type', recordType)
    .in('record_id', recordIds)
    .order('generated_at', { ascending: false });

  if (!includeArchived) query = query.is('archived_at', null);

  if (documentType) query = query.eq('document_type', documentType);

  const { data, error } = await query;

  if (error) throw error;
  return (data ?? []) as GeneratedDocumentRecord[];
}

/**
 * Computes get generated document file name for the surrounding workflow.
 * Fallback/error behavior: Missing optional input uses the defaults defined in the function; unexpected input or runtime failures propagate unless explicitly normalized.
 */
export function getGeneratedDocumentFileName(document: GeneratedDocumentRecord) {
  const storageFileName = document.storage_path.split('/').pop();
  return (
    document.display_file_name ||
    document.file_name ||
    storageFileName ||
    'generated-document.pdf'
  );
}

/**
 * Performs open generated document for the surrounding workflow.
 * Fallback/error behavior: Service, storage, browser, or authentication failures are returned or thrown to the caller for user-visible handling.
 */
export async function openGeneratedDocument(document: GeneratedDocumentRecord) {
  const { data, error } = await supabase.storage
    .from(generatedDocumentsBucket)
    .createSignedUrl(document.storage_path, 60 * 10, { download: false });

  if (error) throw error;
  window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
}

/**
 * Performs download generated document for the surrounding workflow.
 * Fallback/error behavior: Service, storage, browser, or authentication failures are returned or thrown to the caller for user-visible handling.
 */
export async function downloadGeneratedDocument(document: GeneratedDocumentRecord) {
  const { data, error } = await supabase.storage
    .from(generatedDocumentsBucket)
    .download(document.storage_path);

  if (error) throw error;

  const url = URL.createObjectURL(data);
  const link = window.document.createElement('a');
  link.href = url;
  link.download = getGeneratedDocumentFileName(document);
  window.document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Purpose: Defines the save generated document input data contract used by the generated documents module.
 * Fallback/error behavior: This declaration is compile-time only; nullable and optional fields are handled by the owning loader, normalizer, or UI fallback.
 * Known limitation: TypeScript does not generate runtime validation from this declaration, so untrusted service data still requires explicit normalization.
 */
type SaveGeneratedDocumentInput = {
  blob: Blob;
  organizationId: string;
  documentType: GeneratedDocumentType;
  recordType: GeneratedDocumentRecordType;
  recordId: string;
  generatedByUserId: string;
  fileName: string;
  displayFileName?: string;
  storagePath: string;
};

/**
 * Performs save generated document for the surrounding workflow.
 * Fallback/error behavior: Service, storage, browser, or authentication failures are returned or thrown to the caller for user-visible handling.
 */
export async function saveGeneratedDocument({
  blob,
  organizationId,
  documentType,
  recordType,
  recordId,
  generatedByUserId,
  fileName,
  displayFileName,
  storagePath,
}: SaveGeneratedDocumentInput) {
  const { error: uploadError } = await supabase.storage
    .from(generatedDocumentsBucket)
    .upload(storagePath, blob, {
      cacheControl: '31536000',
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { error: insertError } = await supabase
    .from('generated_documents')
    .insert({
      organization_id: organizationId,
      document_type: documentType,
      record_type: recordType,
      record_id: recordId,
      generated_by_user_id: generatedByUserId,
      file_name: fileName,
      display_file_name: displayFileName ?? null,
      storage_path: storagePath,
      file_size: blob.size,
      generated_at: new Date().toISOString(),
    });

  if (insertError) throw insertError;
}

/**
 * Computes get current generated document user id for the surrounding workflow.
 * Fallback/error behavior: Missing optional input uses the defaults defined in the function; unexpected input or runtime failures propagate unless explicitly normalized.
 */
async function getCurrentGeneratedDocumentUserId() {
  const { data: sessionData } = await supabase.auth.getSession();
  const sessionUserId = sessionData.session?.user.id;
  if (sessionUserId) return sessionUserId;

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) {
    throw new Error('You must be signed in to update generated documents.');
  }
  return userId;
}

/**
 * Performs archive generated document for the surrounding workflow.
 * Fallback/error behavior: Service, storage, browser, or authentication failures are returned or thrown to the caller for user-visible handling.
 */
export async function archiveGeneratedDocument(documentId: string) {
  const { error } = await supabase
    .from('generated_documents')
    .update({
      archived_at: new Date().toISOString(),
      archived_by_user_id: await getCurrentGeneratedDocumentUserId(),
    })
    .eq('id', documentId);

  if (error) throw error;
}
