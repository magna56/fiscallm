import { z } from "zod";

// Loose on purpose: RevenueCat adds fields and event types without a
// version change, and only id and type are needed to store an event.
const ms = z.number().nullish();
const str = z.string().nullish();
const num = z.number().nullish();

export const webhookSchema = z.object({
  api_version: z.string().optional(),
  event: z.looseObject({
    id: z.string().min(1).max(200),
    type: z.string().min(1).max(64),
    event_timestamp_ms: ms,
    app_user_id: str,
    original_app_user_id: str,
    aliases: z.array(z.string()).nullish(),
    transferred_from: z.array(z.string()).nullish(),
    transferred_to: z.array(z.string()).nullish(),
    product_id: str,
    new_product_id: str,
    period_type: str,
    purchased_at_ms: ms,
    expiration_at_ms: ms,
    environment: str,
    store: str,
    price: num,
    tax_percentage: num,
    commission_percentage: num,
    is_trial_conversion: z.boolean().nullish(),
  }),
});

export type WebhookEvent = z.output<typeof webhookSchema>["event"];
