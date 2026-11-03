import { Prisma } from '@prisma/client';

type ReceiptBalanceQueryClient = Pick<Prisma.TransactionClient, '$queryRaw'>;

export async function getActiveReceiptAppliedAmounts(
  client: ReceiptBalanceQueryClient,
  tenantId: string,
  invoiceIds: string[],
): Promise<Map<string, Prisma.Decimal>> {
  if (invoiceIds.length === 0) return new Map();
  const rows = await client.$queryRaw<
    Array<{ invoiceId: string; applied: Prisma.Decimal }>
  >`
    SELECT a."invoiceId", COALESCE(SUM(a."amount"), 0)::numeric AS "applied"
    FROM "invoice_receipt_allocations" a
    JOIN "customer_receipts" r
      ON r."id" = a."receiptId" AND r."tenantId" = a."tenantId"
    LEFT JOIN "customer_receipt_reversals" x
      ON x."receiptId" = r."id" AND x."tenantId" = r."tenantId"
    WHERE a."tenantId" = ${tenantId}
      AND a."invoiceId" IN (${Prisma.join(invoiceIds)})
      AND x."id" IS NULL
    GROUP BY a."invoiceId"
  `;
  return new Map(
    rows.map((row) => [row.invoiceId, new Prisma.Decimal(row.applied)]),
  );
}
