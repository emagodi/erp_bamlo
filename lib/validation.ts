import { z } from 'zod';

export const MoneySchema = z.union([z.number(), z.string()]);

export const QuoteLineInputSchema = z.object({
  productId: z.string().optional().nullable(),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: MoneySchema,
  unit: z.string().optional(),
  discount: z
    .object({
      type: z.enum(['percent', 'fixed']),
      value: z.number().nonnegative(),
    })
    .optional()
    .nullable(),
  metaJson: z.unknown().optional(),
});

export const CreateQuoteSchema = z.object({
  customerId: z.string(),
  currency: z.string().default('USD'),
  vatRate: z.number().min(0).max(1).default(parseFloat(process.env.VAT_DEFAULT || '0.15')),
  discountPolicy: z.string().nullable().optional(),
  lines: z.array(QuoteLineInputSchema).min(1),
});

export type CreateQuoteInput = z.infer<typeof CreateQuoteSchema>;

export const ImportResultSchema = z.object({
  productsInserted: z.number(),
  productsUpdated: z.number(),
  rulesInserted: z.number(),
  rulesUpdated: z.number(),
  rulesPreview: z.array(
    z.object({ code: z.string(), expression: z.string(), description: z.string().nullable().optional(), dependsOn: z.array(z.string()) })
  ),
});

