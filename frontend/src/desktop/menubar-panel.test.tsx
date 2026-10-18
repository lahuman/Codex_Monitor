import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MenuBarPanel } from "./menubar-panel";
import { NicknameEditor } from "./nickname-editor";
import { intervalUsage } from "./insights-model";
import type { Sample, Snapshot } from "./data";
const now = 1900000000;
const samples: Sample[] = Array.from({ length: 73 }, (_, i) => ({
  at: now - 21600 + i * 300,
  windows: [
    {
      period: "primary",
      label: "5시간",
      seconds: 18000,
      remaining: 90 - i / 2,
      reset_at: now + 3600,
    },
  ],
}));
const ipc = vi.fn();
let data: Snapshot;
let panelEvent: ((event: { payload: unknown }) => void) | undefined;
beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(now * 1000);
  data = {
    account_labels: {
      one: { nickname: "업무", full: "업무", compact: "업무" },
    },
    accounts: [
      {
        id: "one",
        account_id: "workspace",
        email: "fixture@example.test",
        plan: "plus",
        paused: false,
        quota: null,
        quota_observed_at: new Date(now * 1000).toISOString(),
      },
    ],
    storage_pending: false,
    reset_credits: {},
    usage_errors: {},
    history: { one: structuredClone(samples) },
    quota_windows: { one: structuredClone(samples.at(-1)!.windows) },
    alert_preferences: {},
    poll_status: {},
    monitoring_issue: null,
  };
  ipc.mockReset();
  ipc.mockImplementation(async (name: string) =>
    name === "dashboard" ? structuredClone(data) : undefined,
  );
  panelEvent = undefined;
  Object.assign(window, {
    __TAURI__: {
      core: { invoke: ipc },
      event: {
        listen: async (
          name: string,
          callback: (event: { payload: unknown }) => void,
        ) => {
          if (name === "panel-account-selected") panelEvent = callback;
          return () => {};
        },
      },
    },
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("shows nickname, interval usage, 24h history and scheduled reset without opening main window", async () => {
  render(<MenuBarPanel />);
  await screen.findByRole("combobox", { name: "표시할 계정" });
  expect(screen.getByRole("option", { name: "업무" })).toBeInTheDocument();
  expect(screen.getByLabelText("5시간 최근 1시간 6.0%p")).toBeInTheDocument();
  expect(screen.getByLabelText("5시간 최근 3시간 18.0%p")).toBeInTheDocument();
  expect(screen.getByLabelText("5시간 최근 6시간 36.0%p")).toBeInTheDocument();
  expect(screen.getByText("1시간 0분 후 초기화")).toBeInTheDocument();
  expect(
    screen.getByRole("img", { name: "최근 24시간 잔여 한도 변화" }),
  ).toBeInTheDocument();
  expect(ipc).not.toHaveBeenCalledWith("show_dashboard", expect.anything());
  fireEvent.keyDown(window, { key: "Escape" });
  await waitFor(() =>
    expect(ipc).toHaveBeenCalledWith("hide_monitor_panel", {}),
  );
});
it("account selection, stale and failure states do not invent interval usage", async () => {
  data.usage_errors.one = "offline";
  data.accounts.push({
    ...data.accounts[0],
    id: "two",
    account_id: "other",
    email: null,
  });
  render(<MenuBarPanel />);
  await screen.findByText("offline");
  expect(
    screen.getByLabelText("5시간 최근 1시간 조회 실패"),
  ).toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "two" } });
  expect(screen.getByText("한도 정보 미제공")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "대시보드 열기" }));
  await waitFor(() => expect(ipc).toHaveBeenCalledWith("show_dashboard", {}));
});
it("explains insufficient history and elapsed reset timestamps", async () => {
  data.history.one = [samples.at(-1)!];
  data.quota_windows.one[0].reset_at = now - 1;
  render(<MenuBarPanel />);
  await screen.findByText("초기화 시각 경과 · 갱신 필요");
  expect(
    screen.getByLabelText("5시간 최근 6시간 관측 기록 부족"),
  ).toBeInTheDocument();
});
it("rejects reset identity changes, intermediate increases, missing observations and gaps", () => {
  expect(intervalUsage(samples, "primary", now, 6).value).toBe(36);
  for (const mutate of [
    (s: Sample[]) => {
      s[30].windows[0].reset_at! += 1;
    },
    (s: Sample[]) => {
      s[30].windows[0].remaining = 99;
    },
    (s: Sample[]) => {
      s[30].windows[0].remaining = null;
    },
    (s: Sample[]) => {
      s.splice(25, 4);
    },
  ]) {
    const input = structuredClone(samples);
    mutate(input);
    expect(intervalUsage(input, "primary", now, 6).value).toBeNull();
  }
  expect(intervalUsage(samples, "primary", now + 121, 1).reason).toBe(
    "최신 관측 필요",
  );
});
it("nickname editor submits the entered alias and can clear it", async () => {
  const save = vi.fn(async () => {});
  render(
    <NicknameEditor
      nickname="업무"
      placeholder="fixture@example.test"
      busy={false}
      onSave={save}
    />,
  );
  fireEvent.change(screen.getByLabelText("메뉴 막대 별명"), {
    target: { value: "" },
  });
  fireEvent.click(screen.getByRole("button", { name: "별명 저장" }));
  expect(save).toHaveBeenCalledWith("");
});

it("native account click event wins over a delayed initial selection response", async () => {
  data.accounts.push({
    ...data.accounts[0],
    id: "two",
    email: "second@example.test",
  });
  data.account_labels.two = { nickname: "개인", full: "개인", compact: "개인" };
  let initial: ((id: string) => void) | undefined;
  ipc.mockImplementation(async (name: string) =>
    name === "dashboard"
      ? structuredClone(data)
      : name === "panel_account"
        ? new Promise<string>((resolve) => {
            initial = resolve;
          })
        : undefined,
  );
  render(<MenuBarPanel />);
  await screen.findByRole("combobox");
  const { act } = await import("@testing-library/react");
  await act(async () => {
    panelEvent?.({ payload: "two" });
    initial?.("one");
  });
  expect(screen.getByRole("combobox")).toHaveValue("two");
});

it("shows voucher details and colors only the selected urgent account name", async () => {
  data.reset_credits.one = {
    available_count: 1,
    credits: [
      {
        id: "voucher",
        status: "available",
        expires_at: new Date((now + 3600) * 1000).toISOString(),
      },
    ],
    observed_at: new Date(now * 1000).toISOString(),
    error: null,
  };
  data.voucher_urgency = {
    one: {
      count: 1,
      expires_at: now + 3600,
      observed_at: now,
      valid_until: now + 120,
    },
  };
  data.accounts.push({
    ...data.accounts[0],
    id: "two",
    email: "other@example.test",
  });
  render(<MenuBarPanel />);
  const select = await screen.findByRole("combobox");
  expect(select).toHaveClass("voucher-urgent-name");
  expect(screen.getByText("1개", { selector: "strong" })).toBeInTheDocument();
  expect(screen.getByText("1시간 0분 후 만료")).toBeInTheDocument();
  expect(
    screen.getByRole("status", {
      name: "초기화권 만료 임박 · 7일 미만 1개 · 24시간 이하 1개",
    }),
  ).toBeInTheDocument();
  fireEvent.change(select, { target: { value: "two" } });
  expect(select).not.toHaveClass("voucher-urgent-name");
  expect(screen.queryByText("1시간 0분 후 만료")).not.toBeInTheDocument();
});

it.each(["paused", "stale", "elapsed", "future"])(
  "does not color %s voucher facts",
  async (state) => {
    data.voucher_urgency = {
      one: {
        count: 1,
        expires_at: now + 3600,
        observed_at: now,
        valid_until: now + 120,
      },
    };
    if (state === "paused") data.accounts[0].paused = true;
    if (state === "stale") data.voucher_urgency.one.valid_until = now - 1;
    if (state === "elapsed") data.voucher_urgency.one.expires_at = now;
    if (state === "future") data.voucher_urgency.one.observed_at = now + 1;
    render(<MenuBarPanel />);
    expect(await screen.findByRole("combobox")).not.toHaveClass(
      "voucher-urgent-name",
    );
  },
);

it("expires cached label facts on focus even if the backend repeats the old snapshot", async () => {
  data.voucher_urgency = {
    one: {
      count: 1,
      expires_at: now + 3600,
      observed_at: now,
      valid_until: now + 120,
    },
  };
  render(<MenuBarPanel />);
  const select = await screen.findByRole("combobox");
  expect(select).toHaveClass("voucher-urgent-name");
  vi.mocked(Date.now).mockReturnValue((now + 121) * 1000);
  fireEvent(window, new Event("focus"));
  await waitFor(() => expect(select).not.toHaveClass("voucher-urgent-name"));
});

it("collapses voucher details when switching accounts", async () => {
  const reading = {
    available_count: 2,
    observed_at: new Date(now * 1000).toISOString(),
    error: null,
    credits: [
      {
        id: "later",
        status: "available",
        expires_at: new Date((now + 7200) * 1000).toISOString(),
      },
      {
        id: "near",
        status: "available",
        expires_at: new Date((now + 3600) * 1000).toISOString(),
      },
    ],
  };
  data.reset_credits.one = reading;
  data.accounts.push({
    ...data.accounts[0],
    id: "two",
    email: "other@example.test",
  });
  data.reset_credits.two = structuredClone(reading);
  render(<MenuBarPanel />);
  await screen.findByRole("combobox");
  expect(screen.queryByText("2시간 0분 후 만료")).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "만료일 전체 보기 (2개)" }),
  );
  expect(screen.getByText("2시간 0분 후 만료")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "two" } });
  expect(screen.queryByText("2시간 0분 후 만료")).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "만료일 전체 보기 (2개)" }),
  ).toHaveAttribute("aria-expanded", "false");
});
