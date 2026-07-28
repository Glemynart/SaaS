import { DocumentTemplateType } from '@prisma/client';

const IMMUTABLE_PUBLISHED_DOCUMENT_TYPES = new Set<DocumentTemplateType>([
  DocumentTemplateType.CONTRACT,
  DocumentTemplateType.CERTIFICATION,
]);

export const isImmutablePublishedDocumentType = (
  type: DocumentTemplateType,
): boolean => IMMUTABLE_PUBLISHED_DOCUMENT_TYPES.has(type);
