import { quotaTone } from "./insights-model";
import { ResetCreditsPanel } from "./reset-credits";
import { urgentVoucherLabel } from "./reset-credits-model";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, X, Coins, Clock3 } from "lucide-react";
import {
  SnapshotSchema,
  invoke,
  listenPanelAccount,
  type Snapshot,
} from "./data";
import {
  accountSamples,
  duration,
  intervalUsage,
  observedSeconds,
} from "./insights-model";
import { HistoryGraph } from "./insights";
const accountColors = ["#4a89dc", "#57a58b", "#9a78c2", "#ce9563"];
export function MenuBarPanel() {
  const [data, setData] = useState<Snapshot | null>(null),
    [error, setError] = useState("");
  const [selected, setSelected] = useState(""),
    [now, setNow] = useState(() => Date.now() / 1000);
  const reading = useRef(false);
  const selectionRevision = useRef(0);
  const load = useCallback(async () => {
    if (reading.current) return;
    reading.current = true;
    try {
      setData(SnapshotSchema.parse(await invoke("dashboard")));
      setError("");
    } catch (e) {
      setError(String(e));
    } finally {
      reading.current = false;
    }
  }, []);
  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const focus = () => {
      setNow(Date.now() / 1000);
      void load();
    };
    const timer = setInterval(() => {
      if (!document.hidden) focus();
    }, 5000);
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape")
        void invoke("hide_monitor_panel").catch((e) => setError(String(e)));
    };
    window.addEventListener("focus", focus);
    window.addEventListener("keydown", escape);
    return () => {
      window.clearTimeout(initial);
      clearInterval(timer);
      window.removeEventListener("focus", focus);
      window.removeEventListener("keydown", escape);
    };
  }, [load]);
  useEffect(() => {
    let disposed = false;
    let stop: (() => void) | undefined;
    void listenPanelAccount((id) => {
      selectionRevision.current++;
      setSelected(id);
    })
      .then((unlisten) => {
        if (disposed) unlisten();
        else stop = unlisten;
      })
      .catch((e) => setError(String(e)));
    const revision = selectionRevision.current;
    void invoke("panel_account")
      .then((id) => {
        if (
          !disposed &&
          selectionRevision.current === revision &&
          typeof id === "string"
        )
          setSelected(id);
      })
      .catch((e) => setError(String(e)));
    return () => {
      disposed = true;
      stop?.();
    };
  }, []);
  const account =
    data?.accounts.find((a) => a.id === selected) ?? data?.accounts[0];
  const urgent =
    !!data &&
    !!account &&
    !account.paused &&
    !error &&
    urgentVoucherLabel(data, account.id, now);
  const windows = account ? (data?.quota_windows[account.id] ?? []) : [];
  const at = account ? observedSeconds(account) : null;
  const status = account?.paused
    ? "일시 정지"
    : error || (account && data?.usage_errors[account.id])
      ? "조회 실패"
      : at == null || at > now || now - at > 120
        ? "오래된 값 · 갱신 필요"
        : "최신 관측";
  const usable = status === "최신 관측";
  const samples = data && account ? accountSamples(data, account) : [];
  async function command(name: string) {
    try {
      await invoke(name);
    } catch (e) {
      setError(String(e));
    }
  }
  return (
    <main className="menubar-panel">
      <header className="menubar-heading">
        <span>
          <Coins size={16} /> CODEX MONITOR
        </span>
        <button
          aria-label="빠른 보기 닫기"
          onClick={() => void command("hide_monitor_panel")}
        >
          <X size={16} />
        </button>
      </header>
      {error && (
        <p role="alert" className="menubar-error">
          {error}
        </p>
      )}
      {data?.monitoring_issue && (
        <p role="alert" className="menubar-error">
          {data.monitoring_issue}
        </p>
      )}
      {!data ? (
        <p className="menubar-empty">관측값을 불러오는 중입니다.</p>
      ) : !account ? (
        <p className="menubar-empty">
          연결된 계정이 없습니다. 대시보드에서 계정을 확인하세요.
        </p>
      ) : (
        <>
          <div className="menubar-account">
            <i
              style={{
                background:
                  accountColors[
                    data.accounts.indexOf(account) % accountColors.length
                  ],
              }}
            />
            <div>
              <label htmlFor="panel-account">계정</label>
              <div className="menubar-select">
                <select
                  className={urgent ? "voucher-urgent-name" : undefined}
                  id="panel-account"
                  aria-label="표시할 계정"
                  value={account.id}
                  onChange={(e) => {
                    const id = e.target.value;
                    selectionRevision.current++;
                    setSelected(id);
                    void invoke("select_panel_account", { id }).catch((e) =>
                      setError(String(e)),
                    );
                  }}
                >
                  {data.accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {data.account_labels[a.id]?.full ??
                        a.email ??
                        a.account_id}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </div>
            </div>
            <span
              className={usable ? "menubar-status" : "menubar-status warning"}
            >
              {status}
            </span>
          </div>
          <p className="menubar-observed">
            {account.plan ?? "플랜 미확인"} ·{" "}
            {at == null
              ? "조회 전"
              : `${new Date(at * 1000).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 관측`}
          </p>
          {data.usage_errors[account.id] && (
            <p role="alert" className="menubar-error">
              {data.usage_errors[account.id]}
            </p>
          )}
          <section className="menubar-quotas" aria-label="현재 잔여 한도">
            {windows.length ? (
              windows.map((w) => (
                <article
                  key={w.period}
                  className={`quota-tone-${quotaTone(w.remaining, !usable)}`}
                >
                  <div className="menubar-quota-title">
                    <span>{w.label}</span>
                    <strong>
                      {w.remaining == null
                        ? "—"
                        : `${Math.round(w.remaining)}%`}
                    </strong>
                  </div>
                  <div className="menubar-meter">
                    <i style={{ width: `${w.remaining ?? 0}%` }} />
                  </div>
                  <p>
                    <Clock3 size={11} />
                    {w.reset_at == null
                      ? "초기화 예정 미제공"
                      : w.reset_at <= now
                        ? "초기화 시각 경과 · 갱신 필요"
                        : `${duration(w.reset_at - now)} 후 초기화`}
                  </p>
                  {w.reset_at != null && (
                    <time dateTime={new Date(w.reset_at * 1000).toISOString()}>
                      {new Date(w.reset_at * 1000).toLocaleString("ko-KR", {
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      예정{!usable ? " · 마지막 관측 기준" : ""}
                    </time>
                  )}
                </article>
              ))
            ) : (
              <p className="menubar-empty">한도 정보 미제공</p>
            )}
          </section>
          <section className="menubar-vouchers" aria-label="선택 계정 초기화권">
            <ResetCreditsPanel
              key={account.id}
              observation={data.reset_credits[account.id]}
              now={now}
              paused={account.paused}
              compact
            />
          </section>
          <section className="menubar-history" aria-label="최근 사용량">
            <h2>
              최근 사용량 <small>관측 한도 감소 · %p</small>
            </h2>
            <div className="menubar-intervals">
              <span>한도</span>
              <span>1시간</span>
              <span>3시간</span>
              <span>6시간</span>
              {windows.map((w) => (
                <div className="menubar-interval-row" key={w.period}>
                  <span>{w.label}</span>
                  {[1, 3, 6].map((hours) => {
                    const usage = usable
                      ? intervalUsage(samples, w.period, now, hours)
                      : { value: null, reason: status };
                    return (
                      <span
                        key={hours}
                        title={
                          usage.reason ?? `${hours}시간 동안 관측된 한도 감소`
                        }
                        aria-label={`${w.label} 최근 ${hours}시간 ${usage.value == null ? usage.reason : `${usage.value.toFixed(1)}%p`}`}
                      >
                        {usage.value == null ? (
                          <small>{usage.reason}</small>
                        ) : (
                          <b>
                            {usage.value.toFixed(1)}
                            <small>%p</small>
                          </b>
                        )}
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
            <p className="menubar-note">
              실제 토큰 수가 아닌 관측값 기준입니다. 초기화·기록 부족 구간은
              집계하지 않습니다.
            </p>
          </section>
          <section className="menubar-history" aria-label="24시간 차트">
            <h2>
              최근 24시간 <small>잔여 한도 변화</small>
            </h2>
            <HistoryGraph samples={samples} now={now} />
          </section>
        </>
      )}
      <footer>
        <span>자동 관측 60초</span>
        <button onClick={() => void command("show_dashboard")}>
          대시보드 열기 <ArrowUpRight size={14} />
        </button>
      </footer>
    </main>
  );
}
