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
// Quota color and state must use the same freshness boundary on every surface.
export function isCurrentObservation(
  data: Snapshot,
  account: Snapshot["accounts"][number],
  now: number,
) {
  const at = observedSeconds(account);
  return (
    !account.paused &&
    !data.usage_errors[account.id] &&
    at != null &&
    at <= now &&
    now - at <= 120
  );
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
  const known = values(data, account.id);
  if (account.paused) return "정지";
  if (!isCurrentObservation(data, account, now) || !known.length)
    return "미확인";
  const min = Math.min(...known);
  return min <= 0 ? "소진" : min <= 20 ? "부족" : "정상";
}
export function preference(data: Snapshot, id: string): AlertPreference {
  return data.alert_preferences[id] ?? { enabled: true, threshold: 10 };
}
export function sampleWindow(sample: Sample, period: string) {
  return sample.windows.find((w) => w.period === period);
}
export type IntervalUsage =
  | { value: number; reason: null }
  | { value: null; reason: string };
export function intervalUsage(
  samples: Sample[],
  period: string,
  now: number,
  hours: number,
): IntervalUsage {
  const missing = (reason: string): IntervalUsage => ({ value: null, reason });
  const last = samples.at(-1);
  if (!last || last.at > now || now - last.at > 120)
    return missing("최신 관측 필요");
  const target = last.at - hours * 3600;
  const baseline = samples.findLast((s) => s.at <= target);
  if (!baseline || target - baseline.at > 600) return missing("관측 기록 부족");
  const before = sampleWindow(baseline, period);
  if (
    before?.remaining == null ||
    before.reset_at == null ||
    before.seconds == null
  )
    return missing("한도 정보 부족");
  const between = samples.filter((s) => s.at >= baseline.at && s.at <= last.at);
  for (let i = 0; i < between.length; i++) {
    const window = sampleWindow(between[i], period);
    const previous = i > 0 ? sampleWindow(between[i - 1], period) : null;
    if (i > 0 && between[i].at - between[i - 1].at > 900)
      return missing("관측 공백");
    if (window?.remaining == null) return missing("한도 정보 부족");
    if (
      window.reset_at !== before.reset_at ||
      window.seconds !== before.seconds ||
      (previous?.remaining != null && window.remaining > previous.remaining)
    )
      return missing("초기화·한도 변경 구간");
  }
  return {
    value: before.remaining - sampleWindow(last, period)!.remaining!,
    reason: null,
  };
}
export function decrease(
  samples: Sample[],
  period: string,
  now: number,
): number | null {
  return intervalUsage(samples, period, now, 1).value;
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

export function quotaTone(value: number | null, muted = false) {
  return value == null || muted
    ? "neutral"
    : value >= 50
      ? "green"
      : value >= 25
        ? "yellow"
        : value >= 10
          ? "orange"
          : "red";
}
