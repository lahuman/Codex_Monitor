import { decrease, segments, accountSamples } from "./insights-model";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MonitoringSummary, MonitoringInsights } from "./insights";
import { SnapshotSchema, type Sample } from "./data";
afterEach(cleanup);
const now = 1900000000;
function sample(
  at: number,
  remaining: number | null,
  reset = 2000000000,
): Sample {
  return {
    at,
    windows: [
      {
        period: "secondary",
        label: "주간",
        seconds: 604800,
        remaining,
        reset_at: reset,
      },
    ],
  };
}
function observations() {
  return Array.from({ length: 13 }, (_, i) =>
    sample(now - 3600 + i * 300, 60 - i),
  );
}
it("calculates observed percentage-point decrease and rejects reset/unknown/gap histories", () => {
  const samples = observations();
  expect(decrease(samples, "secondary", now)).toBe(12);
  expect(decrease([samples[0]], "secondary", now)).toBeNull();
  expect(decrease([samples[0], samples.at(-1)!], "secondary", now)).toBeNull();
  expect(
    decrease(
      [...samples.slice(0, -1), sample(now, 90, 2100000000)],
      "secondary",
      now,
    ),
  ).toBeNull();
  expect(
    decrease([...samples.slice(0, -1), sample(now, null)], "secondary", now),
  ).toBeNull();
  expect(
    segments([sample(now - 300, 20), sample(now, 90, 2100000000)], "secondary"),
  ).toHaveLength(2);
});
it("shows countdown, plan, poll timing, history, low-quota alert and account preference controls", () => {
  const samples = observations();
  samples[samples.length - 1] = sample(now, 8);
  const data = SnapshotSchema.parse({
    accounts: [
      {
        id: "fixture",
        account_id: "workspace",
        email: "monitor@example.test",
        plan: "team",
        paused: false,
        quota: null,
        quota_observed_at: new Date(now * 1000).toISOString(),
      },
    ],
    storage_pending: false,
    reset_credits: {},
    usage_errors: {},
    history: { fixture: samples },
    quota_windows: { fixture: sample(now, 8, now + 3600).windows },
    alert_preferences: { fixture: { enabled: true, threshold: 10 } },
    poll_status: {
      fixture: {
        last_attempt_at: now,
        next_refresh_at: now + 60,
        refreshing: false,
      },
    },
    account_labels: {},
    monitoring_issue: null,
  });
  const configure = vi.fn();
  render(
    <>
      <MonitoringSummary data={data} now={now} blurred={false} />
      <MonitoringInsights
        data={data}
        now={now}
        blurred={false}
        busy={false}
        onConfigure={configure}
      />
    </>,
  );
  expect(screen.getByText(/한도 부족 알림/)).toBeInTheDocument();
  expect(screen.getByText(/team · 활성/)).toBeInTheDocument();
  expect(screen.getByText(/1시간 0분 후 초기화/)).toBeInTheDocument();
  expect(screen.getByText(/다음 조회까지 1분/)).toBeInTheDocument();
  expect(
    screen.getByRole("img", { name: "최근 24시간 잔여 한도 변화" }),
  ).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("fixture 알림 기준"), {
    target: { value: "20" },
  });
  expect(configure).toHaveBeenCalledWith("fixture", true, 20);
  fireEvent.click(screen.getByRole("checkbox"));
  expect(configure).toHaveBeenCalledWith("fixture", false, 10);
});
it("excludes paused and stale accounts from low-quota alerts", () => {
  const data = SnapshotSchema.parse({
    accounts: [
      {
        id: "fixture",
        account_id: "workspace",
        email: null,
        plan: null,
        paused: false,
        quota: null,
        quota_observed_at: new Date((now - 500) * 1000).toISOString(),
      },
    ],
    storage_pending: false,
    reset_credits: {},
    usage_errors: {},
    history: {},
    quota_windows: { fixture: sample(now, 0).windows },
    alert_preferences: {},
    poll_status: {},
    account_labels: {},
    monitoring_issue: null,
  });
  const { rerender } = render(
    <MonitoringSummary data={data} now={now} blurred={false} />,
  );
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  data.accounts[0].quota_observed_at = new Date(now * 1000).toISOString();
  data.accounts[0].paused = true;
  rerender(<MonitoringSummary data={data} now={now} blurred={false} />);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("does not count the same observation twice because of timestamp precision", () => {
  const data = SnapshotSchema.parse({
    accounts: [
      {
        id: "fixture",
        account_id: "workspace",
        email: null,
        plan: null,
        paused: false,
        quota: null,
        quota_observed_at: new Date(now * 1000 + 500).toISOString(),
      },
    ],
    storage_pending: false,
    reset_credits: {},
    usage_errors: {},
    history: { fixture: [sample(now, 50)] },
    quota_windows: { fixture: sample(now, 49).windows },
    alert_preferences: {},
    poll_status: {},
    account_labels: {},
    monitoring_issue: null,
  });
  const points = accountSamples(data, data.accounts[0]);
  expect(points).toHaveLength(1);
  expect(points[0].windows[0].remaining).toBe(49);
});
