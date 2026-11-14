# Security Specification — Master PDF & Dafa Summary Store (Single Owner + Single Admin)

## 1. Data Invariants
1. **Default Deny**: All paths not explicitly matched are denied by default (`/{document=**}`).
2. **Deterministic Valid IDs**: Every document ID in `/pdf_summaries/{summaryId}`, `/dafa_summaries/{dafaId}`, and `/admins/{adminUid}` must match `^[a-zA-Z0-9_\-]+$` and be <= 128 chars.
3. **Public Read for Cached Legal Summaries, Zero PII**: `list` and `get` on `pdf_summaries` and `dafa_summaries` enforce `resource.data.isPublic == true` (plus `resource == null` safe existence checks on `get`; non-public documents are restricted to Owner/Admin).
4. **Strict Single-Owner & Single-Admin Write Gate**: All write operations (`create`, `update`, `delete`) on `pdf_summaries` and `dafa_summaries` require `request.auth != null && request.auth.token.email_verified == true` AND either Owner (`barshap.bp2026@gmail.com`) or Admin (`utshabp.upp@gmail.com` or `/admins/{uid}`), plus `incoming().updatedByUid == request.auth.uid`.
5. **Immutable Audit Fields & Server Timestamps**: `createdAt == request.time` on `create`, `incoming().createdAt == existing().createdAt && incoming().updatedAt == request.time` on `update`, and `docId`, `pdfPath`, `pdfName`, `mode`, `language` are immutable.
6. **Strict Keys & Bounded Payloads**: `hasAll` + `hasOnly` on `create`, `affectedKeys().hasOnly(...)` on `update`, string `.size()` bounds on every string field, and `.size()` bounds on every array field.

## 2. Dirty Dozen Payloads (Must Return PERMISSION_DENIED)
1. Unauthenticated `create` on `/pdf_summaries/pdf_1`.
2. Non-owner / non-admin verified Google user (`random@gmail.com`) creating `/pdf_summaries/pdf_1`.
3. Signed-in Owner/Admin with `email_verified: false` creating `/pdf_summaries/pdf_1`.
4. Owner/Admin creating `/pdf_summaries/pdf_1` with `updatedByUid` spoofed to another UID.
5. Owner/Admin creating `/pdf_summaries/bad..id!` with path traversal / invalid characters in docId.
6. Owner/Admin creating `/pdf_summaries/pdf_1` with a shadow field `{ isVerifiedAdmin: true }`.
7. Owner/Admin creating `/pdf_summaries/pdf_1` with `createdAt` backdated instead of `request.time`.
8. Owner/Admin creating `/pdf_summaries/pdf_1` with a 50KB `documentTitle` (> maxLength 500).
9. Owner/Admin creating `/pdf_summaries/pdf_1` with `keyPoints` array of 100 items (> 30 limit).
10. Non-owner, non-admin signed-in user updating or deleting `/pdf_summaries/pdf_1` or `/dafa_summaries/dafa_1`.
11. Owner/Admin updating `/pdf_summaries/pdf_1` while mutating `createdAt`, `docId`, or `pdfPath`.
12. Non-owner, non-admin reading or writing `/admins/victim_uid`.
