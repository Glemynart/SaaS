/** Canonical private object key used by both generated documents and their index. */
export function getCanonicalGeneratedDocumentStorageKey(
  tenantId: string,
  documentId: string,
): string {
  return `pdfs/${tenantId}-${documentId}.pdf`;
}
