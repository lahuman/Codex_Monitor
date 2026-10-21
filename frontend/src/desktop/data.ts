import { productName } from "./branding";
import { z } from "zod";
const windowSchema = z.object({
  used_percent: z.number().finite().nullable().optional(),
  reset_at: z.number().nullable().optional(),
  limit_window_seconds: z.number().nullable().optional(),
});
const quotaSchema = z
  .object({
    rate_limit: z
      .object({
        primary_window: windowSchema.nullable().optional(),
        secondary_window: windowSchema.nullable().optional(),
      })
      .nullable()
      .optional(),
  })
  .passthrough();
export const ObservedWindowSchema = z.object({
  period: z.enum(["primary", "secondary", "monthly"]),
  label: z.string(),
  seconds: z.number().nullable(),
  remaining: z.number().min(0).max(100).nullable(),
  reset_at: z.number().nullable(),
});
export const SampleSchema = z.object({
  at: z.number(),
  windows: z.array(ObservedWindowSchema),
});
export type Sample = z.infer<typeof SampleSchema>;
export type ObservedWindow = z.infer<typeof ObservedWindowSchema>;
export const AlertPreferenceSchema = z.object({
  enabled: z.boolean(),
  threshold: z.number().int().min(1).max(100),
});
export type AlertPreference = z.infer<typeof AlertPreferenceSchema>;
export const ResetCreditObservationSchema = z.object({
  available_count: z.number().int().nonnegative().nullable(),
  credits: z
    .array(
      z.object({
        id: z.string(),
        status: z.string().nullable(),
        expires_at: z.iso.datetime({ offset: true }).nullable(),
      }),
    )
    .nullable(),
  observed_at: z.iso.datetime({ offset: true }).nullable(),
  error: z.string().nullable(),
});
export type ResetCreditObservation = z.infer<
  typeof ResetCreditObservationSchema
>;
export const SnapshotSchema = z.object({
  accounts: z.array(
    z.object({
      id: z.string(),
      account_id: z.string(),
      email: z.string().nullable(),
      plan: z.string().nullable(),
      paused: z.boolean(),
      quota: quotaSchema.nullable(),
      quota_observed_at: z.iso.datetime({ offset: true }).nullable(),
    }),
  ),
  account_labels: z
    .record(
      z.string(),
      z.object({
        nickname: z.string().nullable(),
        full: z.string(),
        compact: z.string(),
      }),
    )
    .default({}),
  storage_pending: z.boolean(),
  reset_credits: z.record(z.string(), ResetCreditObservationSchema),
  voucher_urgency: z
    .record(
      z.string(),
      z.object({
        count: z.number().int().positive(),
        expires_at: z.number().finite(),
        observed_at: z.number().finite(),
        valid_until: z.number().finite(),
      }),
    )
    .optional(),
  usage_errors: z.record(z.string(), z.string()),
  history: z.record(z.string(), z.array(SampleSchema)),
  quota_windows: z.record(z.string(), z.array(ObservedWindowSchema)),
  alert_preferences: z.record(z.string(), AlertPreferenceSchema),
  poll_status: z.record(
    z.string(),
    z.object({
      last_attempt_at: z.number().nullable(),
      next_refresh_at: z.number().nullable(),
      refreshing: z.boolean(),
    }),
  ),
  monitoring_issue: z.string().nullable(),
});
export type Snapshot = z.infer<typeof SnapshotSchema>;
export const DeviceSchema = z.object({
  user_code: z.string(),
  verification_url: z.url(),
  interval_seconds: z.number().positive(),
  expires_at: z.iso.datetime({ offset: true }),
});
export type Device = z.infer<typeof DeviceSchema>;
export async function invoke(
  command: string,
  args: Record<string, unknown> = {},
): Promise<unknown> {
  const api = (
    window as Window & {
      __TAURI__?: {
        core: {
          invoke: (
            command: string,
            args: Record<string, unknown>,
          ) => Promise<unknown>;
        };
      };
    }
  ).__TAURI__;
  if (!api) throw new Error(`${productName} 앱에서 실행해 주세요.`);
  return api.core.invoke(command, args);
}
export function projectAccounts(data: Snapshot) {
  return data.accounts.map((a) => ({
    accountId: a.id,
    email: a.email ?? "",
    displayName: data.account_labels[a.id]?.full || a.email || a.account_id,
    planType: a.plan ?? "플랜 미확인",
  }));
}
export const LoginStatusSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("pending") }),
  z.object({ status: z.literal("retrying"), message: z.string() }),
  z.object({ status: z.literal("connected") }),
]);

async function listenStringEvent(
  name: string,
  handler: (message: string) => void,
): Promise<() => void> {
  const api = (
    window as Window & {
      __TAURI__?: {
        event?: {
          listen: (
            name: string,
            callback: (event: { payload: unknown }) => void,
          ) => Promise<() => void>;
        };
      };
    }
  ).__TAURI__;
  if (!api?.event) return () => {};
  return api.event.listen(name, (event) =>
    handler(
      typeof event.payload === "string"
        ? event.payload
        : "앱 작업 중 오류가 발생했습니다.",
    ),
  );
}

export function listenOperationError(handler: (message: string) => void) {
  return listenStringEvent("operation-error", handler);
}
export function listenPanelAccount(handler: (id: string) => void) {
  return listenStringEvent("panel-account-selected", handler);
}
