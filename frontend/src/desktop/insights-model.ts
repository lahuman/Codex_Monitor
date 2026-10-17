import type { Snapshot, Sample, AlertPreference } from "./data";
export const periods = ["primary", "secondary", "monthly"] as const;
export const colors = {
  primary: "var(--history-primary)",
  secondary: "var(--history-secondary)",
  monthly: "var(--history-monthly)",
};
export function duration(seconds: number) {
  if (seconds <= 0) return "곧";
  const days = Math.floor(seconds / 86400),
    hours = Math.floor((seconds % 86400) / 3600),
    minutes = Math.floor((seconds % 3600) / 60);
  return days
    ? `${days}일 ${hours}시간`
    : hours
      ? `${hours}시간 ${minutes}분`
      : minutes
        ? `${minutes}분`
        : `${Math.ceil(seconds)}초`;
}
export function observedSeconds(account: Snapshot["accounts"][number]) {
  return account.quota_observed_at
    ? Math.floor(Date.parse(account.quota_observed_at) / 1000)
    : null;
}
export function values(data: Snapshot, id: string) {
  return (data.quota_windows[id] ?? []).flatMap((w) =>
    w.remaining == null ? [] : [w.remaining],
  );
}
export function health(
  data: Snapshot,
  account: Snapshot["accounts"][number],
  now: number,
) {
  const at = observedSeconds(account),
    known = values(data, account.id);
  if (account.paused) return "정지";
  if (at == null || now - at > 120 || !known.length) return "미확인";
  const min = Math.min(...known);
  return min <= 0 ? "소진" : min <= 20 ? "부족" : "정상";
}
export function preference(data: Snapshot, id: string): AlertPreference {
  return data.alert_preferences[id] ?? { enabled: true, threshold: 10 };
}
export function sampleWindow(sample: Sample, period: string) {
  return sample.windows.find((w) => w.period === period);
}
export function decrease(
  samples: Sample[],
  period: string,
  now: number,
): number | null {
  const last = samples.at(-1);
  if (!last || last.at > now || now - last.at > 120) return null;
  const target = last.at - 3600;
  const baseline = samples.findLast((s) => s.at <= target);
  if (!baseline || target - baseline.at > 600) return null;
  const before = sampleWindow(baseline, period),
    after = sampleWindow(last, period);
  if (
    before?.remaining == null ||
    after?.remaining == null ||
    before.reset_at == null ||
    before.reset_at !== after.reset_at ||
    before.seconds !== after.seconds
  )
    return null;
  const between = samples.filter((s) => s.at >= baseline.at);
  if (
    between.some((s, i) => {
      const window = sampleWindow(s, period);
      return (
        !window ||
        window.remaining == null ||
        window.reset_at !== before.reset_at ||
        window.seconds !== before.seconds ||
        (i > 0 && s.at - between[i - 1].at > 900)
      );
    })
  )
    return null;
  const diff = before.remaining - after.remaining;
  return diff < 0 ? null : diff;
}
export function segments(samples: Sample[], period: string): Sample[][] {
  const result: Sample[][] = [];
  for (const sample of samples) {
    const window = sampleWindow(sample, period);
    if (window?.remaining == null) {
      result.push([]);
      continue;
    }
    const last = result.at(-1)?.at(-1),
      previous = last ? sampleWindow(last, period) : undefined;
    if (
      !last ||
      !previous ||
      sample.at - last.at > 900 ||
      previous.reset_at !== window.reset_at ||
      previous.seconds !== window.seconds ||
      (previous.remaining != null && window.remaining > previous.remaining)
    )
      result.push([]);
    result.at(-1)!.push(sample);
  }
  return result.filter((s) => s.length > 0);
}
export function accountSamples(
  data: Snapshot,
  account: Snapshot["accounts"][number],
): Sample[] {
  const saved = data.history[account.id] ?? [],
    at = observedSeconds(account);
  const latest =
    at == null ? null : { at, windows: data.quota_windows[account.id] ?? [] };
  return latest && latest.at >= (saved.at(-1)?.at ?? 0)
    ? [...saved.filter((sample) => sample.at < latest.at), latest]
    : saved;
}
