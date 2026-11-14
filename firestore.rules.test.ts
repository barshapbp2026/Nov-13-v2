/**
 * Phase 0 Red-Team Verification Checklist for firestore.rules.
 * Single-Owner (barshap.bp2026@gmail.com) + Single-Admin (utshabp.upp@gmail.com) model.
 */

export const DIRTY_DOZEN_CASES = [
  { id: 1, name: 'Unauthenticated create on pdf_summaries', expected: 'PERMISSION_DENIED' },
  { id: 2, name: 'Non-owner non-admin verified user create on pdf_summaries', expected: 'PERMISSION_DENIED' },
  { id: 3, name: 'Unverified email create on pdf_summaries', expected: 'PERMISSION_DENIED' },
  { id: 4, name: 'Spoofed updatedByUid on create', expected: 'PERMISSION_DENIED' },
  { id: 5, name: 'Invalid docId format on create', expected: 'PERMISSION_DENIED' },
  { id: 6, name: 'Shadow field injection on create', expected: 'PERMISSION_DENIED' },
  { id: 7, name: 'Client-forged createdAt timestamp', expected: 'PERMISSION_DENIED' },
  { id: 8, name: 'Oversized documentTitle string (>500 chars)', expected: 'PERMISSION_DENIED' },
  { id: 9, name: 'Unbounded keyPoints array (>30 items)', expected: 'PERMISSION_DENIED' },
  { id: 10, name: 'Non-owner non-admin update or delete on dafa_summaries', expected: 'PERMISSION_DENIED' },
  { id: 11, name: 'Mutating immutable createdAt, docId, or pdfPath on update', expected: 'PERMISSION_DENIED' },
  { id: 12, name: 'Non-owner non-admin access to /admins collection', expected: 'PERMISSION_DENIED' },
] as const;
