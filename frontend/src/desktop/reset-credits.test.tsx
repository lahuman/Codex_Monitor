import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { ResetCreditsPanel } from "./reset-credits";
import { MonitoringSummary } from "./insights";
import { SnapshotSchema, type ResetCreditObservation } from "./data";

afterEach(cleanup);
const now = 1900000000;
const day = 86400;
const iso = (seconds: number) => new Date(seconds * 1000).toISOString();
function observation(offset = 6 * day): ResetCreditObservation {
  return {
    available_count: 1,
    credits: [
      { id: "soon", status: "available", expires_at: iso(now + offset) },
    ],
    observed_at: iso(now),
    error: null,
  };
}
function dashboard(
  reading: ResetCreditObservation,
  paused = false,
  blurred = false,
) {
  const data = SnapshotSchema.parse({
    accounts: [
      {
        id: "fixture",
        account_id: "workspace",
        email: "expiry@example.test",
        plan: "plus",
        paused,
        quota: null,
        quota_observed_at: iso(now),
      },
    ],
    storage_pending: false,
    reset_credits: { fixture: reading },
    usage_errors: {},
    history: {},
    quota_windows: {},
    alert_preferences: { fixture: { enabled: false, threshold: 10 } },
    poll_status: {},
    account_labels: {},
    monitoring_issue: null,
  });
  return (
    <>
      <MonitoringSummary data={data} now={now} blurred={blurred} />
      <ResetCreditsPanel observation={reading} now={now} paused={paused} />
    </>
  );
}
it("shows shared account/row warnings, countdowns and independent observed counts", () => {
  const reading = observation();
  reading.available_count = 5;
  reading.credits = [
    { id: "undated", status: "available", expires_at: null },
    { id: "six-days", status: "available", expires_at: iso(now + 6 * day) },
    { id: "elapsed", status: "available", expires_at: iso(now - 1) },
    { id: "six-hours", status: "available", expires_at: iso(now + 6 * 3600) },
    { id: "later", status: "available", expires_at: iso(now + 8 * day) },
    { id: "unknown", status: "future_status", expires_at: iso(now + 10) },
    { id: "used", status: "redeemed", expires_at: iso(now + 10) },
  ];
  render(dashboard(reading, false, true));
  const alert = screen.getByRole("alert");
  expect(alert).toHaveTextContent("초기화권 만료 임박");
  expect(alert).toHaveTextContent("7일 미만 2개 · 24시간 이하 1개");
  expect(alert).toHaveTextContent("가장 빠른 만료까지 6시간 0분");
  expect(within(alert).getByText("expiry@example.test")).toHaveClass("blur-sm");
  const panel = screen.getByRole("region", { name: "초기화권" });
  expect(within(panel).getByText("5개")).toBeInTheDocument();
  expect(within(panel).getAllByRole("listitem")).toHaveLength(1);
  expect(within(panel).getByText("6시간 0분 후 만료")).toBeInTheDocument();
  expect(
    within(panel).queryByText("6일 0시간 후 만료"),
  ).not.toBeInTheDocument();
  fireEvent.click(
    within(panel).getByRole("button", { name: "만료일 전체 보기 (5개)" }),
  );
  expect(within(panel).getByText("6일 0시간 후 만료")).toBeInTheDocument();
  expect(within(panel).getByText("6시간 0분 후 만료")).toBeInTheDocument();
  expect(
    within(panel).getByText("만료 시각 경과 · 갱신 필요"),
  ).toBeInTheDocument();
  expect(within(panel).getAllByRole("listitem")).toHaveLength(5);
  fireEvent.click(within(panel).getByRole("button", { name: "접기" }));
  expect(within(panel).getAllByRole("listitem")).toHaveLength(1);
  expect(
    within(panel).getByRole("button", { name: "만료일 전체 보기 (5개)" }),
  ).toHaveAttribute("aria-expanded", "false");
  expect(
    within(panel).queryByRole("button", { name: /사용|초기화 실행/ }),
  ).not.toBeInTheDocument();
});
it.each([
  [7 * day, null],
  [7 * day - 1, "만료 주의"],
  [day + 1, "만료 주의"],
  [day, "만료 임박"],
  [1, "만료 임박"],
  [0, null],
  [-1, null],
] as const)(
  "classifies expiry boundary %s seconds without rounding into the wrong tier",
  (remaining, label) => {
    render(dashboard(observation(remaining)));
    if (label) expect(screen.getByRole("alert")).toHaveTextContent(label);
    else expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  },
);
it.each([
  "zero",
  "unknown-count",
  "missing-details",
  "detail-error",
  "missing-time",
  "future-time",
  "stale",
  "paused",
  "undated",
  "unknown-status",
  "redeemed",
  "inconsistent-count",
])("does not issue a live warning for %s", (kind) => {
  const reading = observation(3600);
  let paused = false;
  if (kind === "zero") reading.available_count = 0;
  if (kind === "unknown-count") reading.available_count = null;
  if (kind === "missing-details") reading.credits = null;
  if (kind === "detail-error") reading.error = "HTTP 503";
  if (kind === "missing-time") reading.observed_at = null;
  if (kind === "future-time") reading.observed_at = iso(now + 1);
  if (kind === "stale") reading.observed_at = iso(now - 121);
  if (kind === "paused") paused = true;
  if (kind === "undated") reading.credits![0].expires_at = null;
  if (kind === "unknown-status") reading.credits![0].status = "future_status";
  if (kind === "redeemed") reading.credits![0].status = "redeemed";
  if (kind === "inconsistent-count")
    reading.credits!.push({
      id: "other",
      status: "available",
      expires_at: iso(now + 7200),
    });
  render(dashboard(reading, paused));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.queryByText("만료 임박")).not.toBeInTheDocument();
  if (kind === "zero")
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  if (kind === "stale")
    expect(screen.getByText("오래된 관측 · 갱신 필요")).toBeInTheDocument();
  if (kind === "paused")
    expect(screen.getByText("모니터링 정지 · 마지막 관측")).toBeInTheDocument();
});
it("retains partial-detail notices while warning only for confirmed vouchers", () => {
  const reading = observation();
  reading.available_count = 3;
  render(dashboard(reading));
  expect(screen.getByRole("alert")).toHaveTextContent("7일 미만 1개");
  expect(screen.getByText(/만료일 미확인/)).toBeInTheDocument();
});
it("reclassifies deadlines and stale observations as the UI clock advances", () => {
  const reading = observation(day + 1);
  const { rerender } = render(
    <ResetCreditsPanel observation={reading} now={now} paused={false} />,
  );
  expect(screen.getByText("만료 주의")).toBeInTheDocument();
  rerender(
    <ResetCreditsPanel observation={reading} now={now + 1} paused={false} />,
  );
  expect(screen.getByText("만료 임박")).toBeInTheDocument();
  rerender(
    <ResetCreditsPanel observation={reading} now={now + 121} paused={false} />,
  );
  expect(screen.queryByText("만료 임박")).not.toBeInTheDocument();
  expect(screen.getByText("오래된 관측 · 갱신 필요")).toBeInTheDocument();
});

it("compact card renders only one expiry with a single accessible warning badge", () => {
  const reading = observation(3600);
  reading.available_count = 3;
  reading.credits!.push(
    { id: "later", status: "available", expires_at: iso(now + 2 * day) },
    { id: "last", status: "available", expires_at: iso(now + 8 * day) },
  );
  const { container } = render(
    <ResetCreditsPanel
      observation={reading}
      now={now}
      paused={false}
      compact
    />,
  );
  expect(screen.getAllByRole("listitem")).toHaveLength(1);
  expect(screen.getByText("3개", { selector: "strong" })).toBeInTheDocument();
  expect(
    screen.getByRole("status", {
      name: "초기화권 만료 임박 · 7일 미만 2개 · 24시간 이하 1개",
    }),
  ).toHaveTextContent("만료 임박");
  expect(container.querySelector(".reset-credit-warning")).toBeNull();
  const toggle = screen.getByRole("button", { name: "만료일 전체 보기 (3개)" });
  expect(toggle.closest(".reset-credit-heading")).not.toBeNull();
  fireEvent.click(toggle);
  expect(screen.getAllByRole("listitem")).toHaveLength(3);
  fireEvent.click(screen.getByRole("button", { name: "접기" }));
  expect(screen.getAllByRole("listitem")).toHaveLength(1);
});
