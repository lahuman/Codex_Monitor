import type { Snapshot, ResetCreditObservation } from "./data";

const DAY = 86400;
const voucherWarningSeconds = 7 * DAY;
const voucherUrgentSeconds = DAY;
type WarningLevel = "soon" | "urgent";
type Credit = NonNullable<ResetCreditObservation["credits"]>[number];
type ResetCreditRow = Credit & {
  remainingSeconds: number | null;
  warning: WarningLevel | null;
};

// One owner for provider status selection, freshness and expiry classification.
// Both dashboard and account-card consumers render these facts.
export function resetCreditView(
  observation: ResetCreditObservation | undefined,
  now: number,
  paused: boolean,
) {
  const count = observation?.available_count;
  const at = observation?.observed_at;
  const age = at == null ? null : now - Date.parse(at) / 1000;
  const state = paused
    ? "paused"
    : age == null || age < 0
      ? "unknown"
      : age > 120
        ? "stale"
        : observation?.error != null
          ? "error"
          : "fresh";
  const available =
    count === 0
      ? []
      : (observation?.credits ?? []).filter(
          (credit) => credit.status === "available",
        );
  const inconsistentCount =
    count != null && count > 0 && available.length > count;
  const canWarn =
    state === "fresh" && count != null && count > 0 && !inconsistentCount;
  const credits: ResetCreditRow[] = available
    .map((credit) => {
      const remainingSeconds =
        credit.expires_at == null
          ? null
          : Date.parse(credit.expires_at) / 1000 - now;
      const warning: WarningLevel | null =
        canWarn &&
        remainingSeconds != null &&
        remainingSeconds > 0 &&
        remainingSeconds < voucherWarningSeconds
          ? remainingSeconds <= voucherUrgentSeconds
            ? "urgent"
            : "soon"
          : null;
      return { ...credit, remainingSeconds, warning };
    })
    .toSorted((a, b) => {
      const tier = (remaining: number | null) =>
        remaining == null ? 2 : remaining > 0 ? 0 : 1;
      const order = tier(a.remainingSeconds) - tier(b.remainingSeconds);
      if (order !== 0) return order;
      if (a.remainingSeconds == null) return b.remainingSeconds == null ? 0 : 1;
      if (b.remainingSeconds == null) return -1;
      return a.remainingSeconds - b.remainingSeconds;
    });
  const expiring = credits.filter((credit) => credit.warning != null);
  const nearest = expiring[0];
  return {
    state,
    credits,
    inconsistentCount,
    missingDetails:
      count !== 0 &&
      (observation?.credits == null ||
        (count != null && available.length < count)),
    warning:
      nearest == null
        ? null
        : {
            level: nearest.warning!,
            count: expiring.length,
            urgentCount: expiring.filter(
              (credit) => credit.warning === "urgent",
            ).length,
            nearest,
          },
  };
}

// The Rust monitor owns candidate selection; this guard only expires a cached
// label fact against the live UI clock (including failed IPC reads).
export function urgentVoucherLabel(data: Snapshot, id: string, now: number) {
  const fact = data.voucher_urgency?.[id];
  return (
    !!fact &&
    now >= fact.observed_at &&
    now <= fact.valid_until &&
    now < fact.expires_at
  );
}
