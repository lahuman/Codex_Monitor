import configuration from "../../../desktop/src-tauri/tauri.conf.json";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import i18n from "@/i18n";
import { DesktopApp } from "./App";
import { type Snapshot } from "./data";

let snapshot: Snapshot;
const ipc = vi.fn();
function mount(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <DesktopApp />
    </MemoryRouter>,
  );
}
beforeEach(async () => {
  await i18n.changeLanguage("ko");
  window.localStorage.clear();
  ipc.mockReset();
  snapshot = {
    storage_pending: false,
    reset_credits: {},
    usage_errors: {},
    history: {},
    quota_windows: {
      "seat-one": [
        {
          period: "primary",
          label: "5시간",
          seconds: 18000,
          remaining: 75,
          reset_at: 1900000000,
        },
        {
          period: "secondary",
          label: "주간",
          seconds: 604800,
          remaining: 60,
          reset_at: 1900100000,
        },
      ],
    },
    alert_preferences: {},
    poll_status: {},
    account_labels: {},
    monitoring_issue: null,
    accounts: [
      {
        id: "seat-one",
        account_id: "workspace",
        email: "fixture@example.test",
        plan: "plus",
        paused: false,
        quota: {
          rate_limit: {
            primary_window: {
              used_percent: 25,
              reset_at: 1900000000,
              limit_window_seconds: 18000,
            },
            secondary_window: {
              used_percent: 40,
              reset_at: 1900100000,
              limit_window_seconds: 604800,
            },
          },
        },
        quota_observed_at: new Date().toISOString(),
      },
    ],
  };
  ipc.mockImplementation(async (command: string) => {
    if (command === "pending_login") return null;
    if (command === "dashboard") {
      const result = structuredClone(snapshot);
      return result;
    }
    if (command === "start_login")
      return {
        user_code: "TEST-CODE",
        verification_url: "https://auth.openai.com/codex/device",
        interval_seconds: 60,
        expires_at: new Date(Date.now() + 900000).toISOString(),
      };
    if (command === "change_account") {
      snapshot.accounts[0].paused = true;
      return null;
    }
    if (command === "refresh_usage") return null;
    if (command === "cancel_login") return null;
    if (command === "open_login_page") throw new Error("browser unavailable");
    throw new Error(`Unexpected command ${command}`);
  });
  Object.defineProperty(window, "__TAURI__", {
    configurable: true,
    value: { core: { invoke: ipc } },
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe("embedded dashboard using real upstream components", () => {
  it("shows provider quota without relay statistics", async () => {
    mount();
    await screen.findByText("5시간 · 잔여 75%");
    expect(
      screen.queryByRole("link", { name: "연결 설정" }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText("5시간 · 잔여 75%").length).toBeGreaterThan(0);
    expect(screen.getAllByText("주간 · 잔여 60%").length).toBeGreaterThan(0);
    expect(screen.queryByText("요청")).not.toBeInTheDocument();
    expect(screen.queryByText("토큰")).not.toBeInTheDocument();
    expect(screen.queryByText("비용")).not.toBeInTheDocument();
    expect(screen.queryByText("오류율")).not.toBeInTheDocument();
    expect(screen.queryByText("요청 기록")).not.toBeInTheDocument();
    expect(
      ipc.mock.calls.some(([command]) => command === "application_status"),
    ).toBe(false);
  });
  it("preserves unknown quota", async () => {
    snapshot.accounts[0].quota = null;
    snapshot.quota_windows = {};
    mount();
    await screen.findByText("한도 미확인");
    expect(
      screen.getByText("이 기간의 한도가 아직 관측되지 않았습니다."),
    ).toBeInTheDocument();
    expect(screen.queryByText("75%")).not.toBeInTheDocument();
  });
  it("opens device login in the app, without opening a browser automatically", async () => {
    mount("/accounts");
    await screen.findByRole("button", { name: "계정 연결" });
    fireEvent.click(screen.getByRole("button", { name: "계정 연결" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("로그인 주소")).toHaveValue(
      "https://auth.openai.com/codex/device",
    );
    expect(within(dialog).getByLabelText("인증 코드")).toHaveValue("TEST-CODE");
    expect(ipc).not.toHaveBeenCalledWith("open_login_page", expect.anything());
    fireEvent.click(
      within(dialog).getByRole("button", { name: "기본 브라우저로 열기" }),
    );
    await waitFor(() =>
      expect(within(dialog).getByRole("status")).toHaveTextContent(
        "Error: browser unavailable",
      ),
    );
    expect(within(dialog).getByLabelText("인증 코드")).toHaveValue("TEST-CODE");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "닫기 · 로그인 취소" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(ipc).toHaveBeenCalledWith("cancel_login", {});
  });
  it("connects account actions to Rust IPC", async () => {
    mount("/accounts");
    await screen.findByText("fixture@example.test");
    fireEvent.click(screen.getByRole("button", { name: "사용량 조회" }));
    await waitFor(() =>
      expect(ipc).toHaveBeenCalledWith("refresh_usage", { id: "seat-one" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "일시 정지" })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "일시 정지" }));
    await screen.findByRole("button", { name: "재개" });
    expect(ipc).toHaveBeenCalledWith("change_account", {
      id: "seat-one",
      remove: false,
      paused: true,
    });
  });
  it("shows the account-connection empty state without sample data", async () => {
    snapshot.accounts = [];
    mount();
    await screen.findByText("모니터링할 계정이 없습니다.");
    expect(screen.queryByText("fixture-model")).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /잔여/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /계정/ })).toBeInTheDocument();
  });
});

it.each([
  [604800, "secondary"],
  [2592000, "monthly"],
] as const)(
  "renders canonical %s second quota in account management without reinterpreting raw quota",
  async (seconds, period) => {
    snapshot.quota_windows = {
      "seat-one": [
        {
          period,
          label: period === "secondary" ? "주간" : "월간",
          seconds,
          remaining: 63,
          reset_at: 1900000000,
        },
      ],
    };
    // Raw provider fixture still contains a conflicting 5-hour value.
    mount("/accounts");
    const bar = await screen.findByRole("progressbar", {
      name: period === "secondary" ? "주간 잔여" : "월간 잔여",
    });
    expect(bar).toHaveAttribute("aria-valuenow", "63");
    expect(
      screen.queryByRole("progressbar", { name: "5시간 잔여" }),
    ).not.toBeInTheDocument();
  },
);

it("displays each account quota without scaling and replaces it after refresh", async () => {
  snapshot.accounts.push({
    ...snapshot.accounts[0],
    id: "seat-two",
    email: "second@example.test",
  });
  snapshot.quota_windows["seat-one"] = [
    {
      period: "primary",
      label: "5시간",
      seconds: 18000,
      remaining: 63,
      reset_at: null,
    },
  ];
  snapshot.quota_windows["seat-two"] = [
    {
      period: "primary",
      label: "5시간",
      seconds: 18000,
      remaining: 16,
      reset_at: null,
    },
  ];
  mount();
  await screen.findByText("5시간 · 잔여 63%");
  expect(screen.getByText("5시간 · 잔여 16%")).toBeInTheDocument();
  expect(screen.queryByText("31.5")).not.toBeInTheDocument();
  const original = ipc.getMockImplementation()!;
  ipc.mockImplementation(async (command, args) => {
    if (command === "refresh_usage" && args.id === "seat-one") {
      snapshot.quota_windows["seat-one"][0].remaining = 49;
      snapshot.accounts[0].quota_observed_at = "2026-10-16T12:00:00Z";
    }
    return original(command, args);
  });
  fireEvent.click(screen.getByRole("button", { name: "사용량 새로고침" }));
  await screen.findByText("5시간 · 잔여 49%");
  expect(screen.queryByText("5시간 · 잔여 63%")).not.toBeInTheDocument();
  expect(screen.getAllByText(/최근 조회:/).length).toBeGreaterThan(0);
});

it("shows shared monitoring failures and clears them after a successful manual refresh", async () => {
  snapshot.accounts[0].quota_observed_at = "2020-01-01T00:00:00Z";
  snapshot.usage_errors = { "seat-one": "fixture quota unavailable" };
  const original = ipc.getMockImplementation()!;
  ipc.mockImplementation(async (command, args) => {
    if (command === "refresh_usage")
      throw new Error("fixture quota unavailable");
    return original(command, args);
  });
  snapshot.accounts.push({
    ...snapshot.accounts[0],
    id: "paused-seat",
    paused: true,
  });
  snapshot.quota_windows["paused-seat"] = structuredClone(
    snapshot.quota_windows["seat-one"],
  );
  mount();
  await screen.findByText(/사용량 조회 실패/);
  expect(screen.getAllByText(/오래된 사용량/)).toHaveLength(2);
  expect(
    screen.queryByRole("button", { name: "계정 연결" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText(/127.0.0.1/)).not.toBeInTheDocument();
  expect(screen.getAllByText("5시간 · 잔여 75%")).toHaveLength(2);
  expect(
    ipc.mock.calls.filter(([command]) => command === "refresh_usage"),
  ).toHaveLength(0);
  ipc.mockImplementation(async (command, args) => {
    if (command === "refresh_usage") {
      snapshot.accounts[0].quota_observed_at = new Date().toISOString();
      snapshot.usage_errors = {};
      return null;
    }
    return original(command, args);
  });
  fireEvent.click(screen.getByRole("button", { name: "사용량 새로고침" }));
  await waitFor(() =>
    expect(screen.queryByText(/사용량 조회 실패/)).not.toBeInTheDocument(),
  );
});

it("saves account alert settings through desktop IPC and refreshes the selected value", async () => {
  snapshot.quota_windows = {
    "seat-one": [
      {
        period: "secondary",
        label: "주간",
        seconds: 604800,
        remaining: 8,
        reset_at: 1900000000,
      },
    ],
  };
  snapshot.alert_preferences = { "seat-one": { enabled: true, threshold: 10 } };
  const original = ipc.getMockImplementation()!;
  ipc.mockImplementation(async (command, args) => {
    if (command === "configure_alert") {
      snapshot.alert_preferences[args.id] = {
        enabled: args.enabled,
        threshold: args.threshold,
      };
      return null;
    }
    return original(command, args);
  });
  mount();
  const select = await screen.findByLabelText("seat-one 알림 기준");
  fireEvent.change(select, { target: { value: "20" } });
  await waitFor(() =>
    expect(ipc).toHaveBeenCalledWith("configure_alert", {
      id: "seat-one",
      enabled: true,
      threshold: 20,
    }),
  );
  await waitFor(() => expect(select).toHaveValue("20"));
  expect(screen.getByText("알림 설정을 저장했습니다.")).toBeInTheDocument();
});

it("keeps account identity above charts and compact legends semantic", async () => {
  mount();
  await screen.findByText("5시간 · 잔여 75%");
  const legend = screen.getByRole("list", { name: "한도 범례" });
  expect(
    within(legend)
      .getAllByRole("listitem")
      .map((item) => item.textContent),
  ).toEqual(["잔여", "사용"]);
  expect(legend).not.toHaveTextContent("fixture@example.test");
  const identity = screen.getByText("fixture@example.test");
  expect(identity.closest("header")).not.toBeNull();
  expect(screen.getAllByText("fixture@example.test")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "이메일 가리기" }));
  expect(identity).toHaveClass("blur-sm");
});

it("shows account voucher count and ordered expiry dates, without interpreting future statuses", async () => {
  snapshot.reset_credits["seat-one"] = {
    available_count: 3,
    credits: [
      { id: "undated", status: "available", expires_at: null },
      { id: "later", status: "available", expires_at: "2031-09-20T12:00:00Z" },
      {
        id: "future",
        status: "future_status",
        expires_at: "2031-01-01T00:00:00Z",
      },
      {
        id: "earlier",
        status: "available",
        expires_at: "2031-08-20T12:00:00Z",
      },
      { id: "used", status: "redeemed", expires_at: "2031-01-02T00:00:00Z" },
    ],
    observed_at: new Date().toISOString(),
    error: null,
  };
  mount();
  const account = (await screen.findByText("fixture@example.test")).closest(
    "article",
  )!;
  const panel = within(account).getByRole("region", { name: "초기화권" });
  expect(within(panel).getByText("3개")).toBeInTheDocument();
  expect(within(panel).getAllByRole("listitem")).toHaveLength(1);
  fireEvent.click(
    within(panel).getByRole("button", { name: "만료일 전체 보기 (3개)" }),
  );
  const dates = within(
    within(panel).getByRole("list", { name: "초기화권 만료일" }),
  ).getAllByRole("listitem");
  expect(dates).toHaveLength(3);
  expect(dates[0].querySelector("time")).toHaveAttribute(
    "dateTime",
    "2031-08-20T12:00:00Z",
  );
  expect(dates[1].querySelector("time")).toHaveAttribute(
    "dateTime",
    "2031-09-20T12:00:00Z",
  );
  expect(dates[2]).toHaveTextContent("만료일 미제공");
  expect(
    within(panel).queryByRole("button", { name: /사용|초기화 실행/ }),
  ).not.toBeInTheDocument();
});
it("distinguishes zero vouchers, unavailable details and stale known counts", async () => {
  snapshot.reset_credits["seat-one"] = {
    available_count: 0,
    credits: [],
    observed_at: new Date().toISOString(),
    error: null,
  };
  const first = mount();
  await screen.findByText("사용 가능한 초기화권이 없습니다.");
  first.unmount();
  snapshot.reset_credits["seat-one"] = {
    available_count: 2,
    credits: null,
    observed_at: new Date(Date.now() - 300000).toISOString(),
    error: "HTTP 503",
  };
  const second = mount();
  await screen.findByText("2개");
  expect(screen.getByText("오래된 관측 · 갱신 필요")).toBeInTheDocument();
  expect(screen.getByText(/만료일 미확인/)).toBeInTheDocument();
  expect(
    screen.getByText(/초기화권 상세 조회 실패 · HTTP 503/),
  ).toBeInTheDocument();
  second.unmount();
  snapshot.reset_credits = {};
  mount();
  const panel = await screen.findByRole("region", { name: "초기화권" });
  expect(within(panel).getByText("미확인")).toBeInTheDocument();
  expect(within(panel).queryByText("0개")).not.toBeInTheDocument();
});

it("shows the release product identity and configured version in the about dialog", async () => {
  mount();
  await screen.findByText("5시간 · 잔여 75%");
  expect(
    screen.getByRole("link", { name: "Codex Monitor" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "앱 정보" }));
  const dialog = screen.getByRole("dialog");
  expect(
    within(dialog).getByRole("heading", { name: "Codex Monitor" }),
  ).toBeInTheDocument();
  expect(
    within(dialog).getByText(`버전 ${configuration.version}`),
  ).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("button", { name: "닫기" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
});

it("ages voucher warnings on focus even when the local snapshot request fails", async () => {
  const milliseconds = Date.now();
  const clock = vi.spyOn(Date, "now").mockReturnValue(milliseconds);
  try {
    snapshot.reset_credits["seat-one"] = {
      available_count: 1,
      credits: [
        {
          id: "soon",
          status: "available",
          expires_at: new Date(milliseconds + 3600000).toISOString(),
        },
      ],
      observed_at: new Date(milliseconds).toISOString(),
      error: null,
    };
    mount();
    await screen.findByText(/초기화권 만료 임박/);
    ipc.mockRejectedValue(new Error("local snapshot unavailable"));
    clock.mockReturnValue(milliseconds + 121000);
    fireEvent(window, new Event("focus"));
    await waitFor(() =>
      expect(screen.queryByText(/초기화권 만료 임박/)).not.toBeInTheDocument(),
    );
    expect(screen.getByText("오래된 관측 · 갱신 필요")).toBeInTheDocument();
  } finally {
    clock.mockRestore();
  }
});

it("restores browser login, pauses hidden polling and completes with manual recheck after transient failure", async () => {
  const original = ipc.getMockImplementation()!;
  let count = 0;
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: true,
  });
  ipc.mockImplementation(async (command: string) => {
    if (command === "pending_login")
      return {
        user_code: "RESTORED-CODE",
        verification_url: "https://auth.openai.com/codex/device",
        interval_seconds: 60,
        expires_at: new Date(Date.now() + 900000).toISOString(),
      };
    if (command === "poll_login")
      return ++count === 1
        ? { status: "retrying", message: "연결 확인 재시도 중" }
        : { status: "connected" };
    return original(command);
  });
  mount("/accounts");
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByLabelText("인증 코드")).toHaveValue(
    "RESTORED-CODE",
  );
  expect(count).toBe(0);
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: false,
  });
  fireEvent(document, new Event("visibilitychange"));
  await waitFor(() =>
    expect(within(dialog).getByRole("status")).toHaveTextContent(
      "연결 확인 재시도 중",
    ),
  );
  expect(within(dialog).getByLabelText("인증 코드")).toHaveValue(
    "RESTORED-CODE",
  );
  fireEvent.click(
    within(dialog).getByRole("button", { name: "연결 상태 다시 확인" }),
  );
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(count).toBe(2);
  expect(ipc.mock.calls.some(([name]) => name === "start_login")).toBe(false);
});
it("uses mobile cards and keeps collection settings in the menu", async () => {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Android 14");
  const original = ipc.getMockImplementation()!;
  ipc.mockImplementation(async (name: string) =>
    name === "mobile_settings"
      ? {
          minutes: 10,
          background_minutes: 15,
          background_state: "scheduled",
          last_worker_at: null,
          last_worker_result: null,
        }
      : original(name),
  );
  mount();
  await screen.findByRole("region", { name: "모바일 계정 대시보드" });
  expect(screen.queryByLabelText("자동 조회 간격")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("region", { name: "한도 상태 요약" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "메뉴 및 조회 설정" }));
  const menu = await screen.findByRole("dialog");
  await waitFor(() =>
    expect(within(menu).getByRole("combobox")).toHaveValue("10"),
  );
  fireEvent.click(within(menu).getByRole("link", { name: "계정 관리" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(
    await screen.findByRole("button", { name: "계정 연결" }),
  ).toBeVisible();
});

it.each(["stale", "future", "error", "paused"])(
  "mutes %s quota consistently in account management",
  async (mode) => {
    const a = snapshot.accounts[0];
    if (mode === "stale")
      a.quota_observed_at = new Date(Date.now() - 300000).toISOString();
    if (mode === "future")
      a.quota_observed_at = new Date(Date.now() + 300000).toISOString();
    if (mode === "error") snapshot.usage_errors[a.id] = "unavailable";
    if (mode === "paused") a.paused = true;
    mount("/accounts");
    const bar = await screen.findByRole("progressbar", { name: "5시간 잔여" });
    expect(bar).toHaveAttribute("aria-valuenow", "75");
    expect(bar.parentElement).toHaveClass("quota-tone-neutral");
  },
);
