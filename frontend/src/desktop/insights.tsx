import { resetCreditView } from "./reset-credits-model";
import { TriangleAlert } from "lucide-react";
import { ResetCreditsPanel } from "./reset-credits";
import { QuotaMeter, QuotaLegend } from "./components";
import type { Snapshot, Sample, ObservedWindow, AlertPreference } from "./data";

import {
  periods,
  colors,
  duration,
  observedSeconds,
  values,
  health,
  preference,
  sampleWindow,
  decrease,
  segments,
  accountSamples,
  isCurrentObservation,
} from "./insights-model";
export function MonitoringSummary({
  data,
  now,
  blurred,
}: {
  data: Snapshot;
  now: number;
  blurred: boolean;
}) {
  const counts = { 정상: 0, 부족: 0, 소진: 0, 미확인: 0, 정지: 0 };
  for (const account of data.accounts) counts[health(data, account, now)]++;
  const alerts = data.accounts.filter((a) => {
    const pref = preference(data, a.id),
      known = values(data, a.id);
    return (
      isCurrentObservation(data, a, now) &&
      pref.enabled &&
      known.some((v) => v <= pref.threshold)
    );
  });
  const voucherAlerts = data.accounts.flatMap((account) => {
    const warning = resetCreditView(
      data.reset_credits[account.id],
      now,
      account.paused,
    ).warning;
    return warning ? [{ account, warning }] : [];
  });
  return (
    <section className="space-y-3" aria-label="한도 상태 요약">
      <div className="monitor-summary">
        {Object.entries(counts).map(([label, count]) => (
          <article key={label} className="monitor-stat">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-medium tabular-nums">
              {count}
              <span className="ml-1 text-xs font-normal">개</span>
            </p>
          </article>
        ))}
      </div>
      {data.monitoring_issue && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive"
        >
          {data.monitoring_issue}
        </p>
      )}
      {voucherAlerts.map(({ account, warning }) => (
        <div
          role="alert"
          key={`voucher-${account.id}`}
          className={`reset-credit-summary reset-credit-warning-${warning.level}`}
        >
          <TriangleAlert aria-hidden="true" size={17} />
          <div>
            <p className="font-medium">
              <span className={blurred ? "blur-sm" : ""}>
                {account.email || account.account_id}
              </span>
              {" · 초기화권 "}
              {warning.level === "urgent" ? "만료 임박" : "만료 주의"}
            </p>
            <p className="text-xs">
              7일 미만 {warning.count}개
              {warning.urgentCount > 0
                ? ` · 24시간 이하 ${warning.urgentCount}개`
                : ""}
              {" · 가장 빠른 만료까지 "}
              {duration(warning.nearest.remainingSeconds!)}
            </p>
          </div>
        </div>
      ))}
      {alerts.map((account) => (
        <p
          role="alert"
          key={account.id}
          className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm"
        >
          <span className={blurred ? "blur-sm" : ""}>
            {account.email || account.account_id}
          </span>{" "}
          · 한도 부족 알림 · 잔여 {Math.min(...values(data, account.id))}% ·
          설정 기준 {preference(data, account.id).threshold}% 이하
        </p>
      ))}
    </section>
  );
}
export function HistoryGraph({
  samples,
  now,
}: {
  samples: Sample[];
  now: number;
}) {
  const visible = samples.filter((s) => s.at >= now - 86400 && s.at <= now);
  if (visible.length < 2)
    return (
      <p className="rounded-lg bg-muted/40 p-4 text-xs text-muted-foreground">
        관측 이력 수집 중 · 2회 이상의 관측이 쌓이면 변화 그래프를 표시합니다.
      </p>
    );
  const available = periods.filter((period) =>
    visible.some((s) => sampleWindow(s, period)?.remaining != null),
  );
  if (!available.length)
    return (
      <p className="text-xs text-muted-foreground">
        사용 가능한 한도 관측값이 없습니다.
      </p>
    );
  return (
    <div className="space-y-2">
      <div className="history-frame">
        <div className="history-y-labels" aria-hidden="true">
          <span>100%</span>
          <span>50%</span>
          <span>0%</span>
        </div>
        <svg
          viewBox="38 24 586 124"
          preserveAspectRatio="none"
          role="img"
          aria-label="최근 24시간 잔여 한도 변화"
          className="history-plot"
        >
          {[0, 50, 100].map((value) => (
            <g key={value}>
              <line
                x1="38"
                y1={140 - value * 1.08}
                x2="624"
                y2={140 - value * 1.08}
                stroke="currentColor"
                opacity="0.12"
              />
            </g>
          ))}
          {available.flatMap((period) =>
            segments(visible, period).map((part, index) => (
              <polyline
                key={`${period}-${index}`}
                fill="none"
                stroke={colors[period]}
                strokeWidth="2"
                points={part
                  .map(
                    (s) =>
                      `${38 + (586 * (s.at - (now - 86400))) / 86400},${140 - sampleWindow(s, period)!.remaining! * 1.08}`,
                  )
                  .join(" ")}
              >
                <title>
                  {part[0].windows.find((w) => w.period === period)?.label}
                </title>
              </polyline>
            )),
          )}
        </svg>
      </div>
      <div className="history-x-labels" aria-hidden="true">
        <span>24시간 전</span>
        <span>12시간 전</span>
        <span>지금</span>
      </div>
      <p className="history-legend" aria-label="변화 그래프 범례">
        {available.map((period) => (
          <span key={period}>
            <i style={{ background: colors[period] }} />
            {
              visible.flatMap((s) => s.windows).find((w) => w.period === period)
                ?.label
            }
          </span>
        ))}
      </p>
      <p className="text-[11px] text-muted-foreground">
        {new Date(visible[0].at * 1000).toLocaleString("ko-KR")}부터{" "}
        {visible.length}개 관측 · 초기화·15분 초과 공백은 연결하지 않습니다.
      </p>
    </div>
  );
}
function WindowInsight({
  window,
  samples,
  now,
  muted,
}: {
  window: ObservedWindow;
  muted: boolean;
  samples: Sample[];
  now: number;
}) {
  const diff = decrease(samples, window.period, now);
  return (
    <div className="quota-tile">
      <div className="quota-tile-body">
        <QuotaMeter
          label={window.label}
          value={window.remaining}
          muted={muted}
        />
        <div className="space-y-2 text-xs">
          <p className="font-medium">
            {window.label} · 잔여{" "}
            {window.remaining == null ? "—" : `${window.remaining}%`}
          </p>
          <p>
            {window.reset_at == null
              ? "초기화 시각 미제공"
              : window.reset_at <= now
                ? "초기화 예정 시각 경과 · 다음 조회 확인 필요"
                : `${duration(window.reset_at - now)} 후 초기화 · ${new Date(window.reset_at * 1000).toLocaleString("ko-KR")}`}
          </p>
          <p>
            최근 약 1시간 감소:{" "}
            {diff == null
              ? "— · 충분한 동일 초기화 주기 이력이 필요합니다."
              : `${diff.toFixed(1)}%p`}
          </p>
        </div>
      </div>
    </div>
  );
}
export function MonitoringInsights({
  data,
  now,
  blurred,
  busy,
  onConfigure,
}: {
  data: Snapshot;
  now: number;
  blurred: boolean;
  busy: boolean;
  onConfigure: (id: string, enabled: boolean, threshold: number) => void;
}) {
  return (
    <section className="space-y-4" aria-label="계정 모니터링">
      <h2 className="section-title">계정 모니터링</h2>
      {!data.accounts.length && (
        <p className="text-sm text-muted-foreground">
          모니터링할 계정이 없습니다.
        </p>
      )}
      <div className="monitor-accounts">
        {data.accounts.map((account, index) => {
          const at = observedSeconds(account),
            age = at == null ? null : Math.max(0, now - at),
            state = health(data, account, now),
            pref = preference(data, account.id),
            poll = data.poll_status[account.id];
          const samples = accountSamples(data, account),
            windows = data.quota_windows[account.id] ?? [];
          return (
            <article key={account.id} className="monitor-account space-y-4">
              <header className="account-heading">
                <span
                  className={`account-dot account-color-${index % 8}`}
                  aria-hidden="true"
                />
                <div className="account-identity">
                  <p className={`account-name ${blurred ? "blur-sm" : ""}`}>
                    {data.account_labels[account.id]?.full ||
                      account.email ||
                      account.account_id}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {account.plan ?? "플랜 미확인"} ·{" "}
                    {account.paused ? "일시 정지" : "활성"}
                  </p>
                </div>
                <span className="account-state" data-state={state}>
                  {state}
                </span>
              </header>
              <p className="text-sm">
                {account.paused
                  ? "모니터링 일시 정지"
                  : state === "미확인"
                    ? "한도 미확인"
                    : state === "소진"
                      ? "잔여 한도 소진"
                      : state === "부족"
                        ? "잔여 한도 주의 · 20% 이하"
                        : "잔여 한도 정상"}
              </p>
              <p className="text-xs text-muted-foreground">
                {at != null && (
                  <span>
                    최근 조회:{" "}
                    <time dateTime={new Date(at * 1000).toISOString()}>
                      {new Date(at * 1000).toLocaleString("ko-KR")}
                    </time>{" "}
                    ·{" "}
                  </span>
                )}
                {age == null
                  ? "사용량 조회 전"
                  : at! > now
                    ? "조회 시각 확인 필요"
                  : age > 120
                    ? "오래된 사용량 · 2분 이상 경과"
                    : `최근 2분 이내 관측 · ${age < 1 ? "방금 확인" : duration(age) + " 전 확인"}`}{" "}
                ·{" "}
                {account.paused
                  ? "자동 조회 정지"
                  : poll?.refreshing
                    ? "사용량 조회 중"
                    : poll?.next_refresh_at != null
                      ? `다음 조회까지 ${duration(poll.next_refresh_at - now)}`
                      : "다음 조회 대기"}
              </p>
              {data.usage_errors[account.id] && (
                <p role="alert" className="text-sm text-destructive">
                  사용량 조회 실패 · {data.usage_errors[account.id]}
                </p>
              )}
              <QuotaLegend />
              <div className="quota-grid">
                {windows.map((w) => (
                  <WindowInsight
                    key={w.period}
                    window={w}
                    samples={samples}
                    now={now}
                    muted={state === "미확인" || account.paused}
                  />
                ))}
              </div>
              {!windows.length && (
                <p className="text-sm text-muted-foreground">
                  이 기간의 한도가 아직 관측되지 않았습니다.
                </p>
              )}
              <ResetCreditsPanel
                observation={data.reset_credits[account.id]}
                now={now}
                paused={account.paused}
              />
              <div className="history-section">
                <h3 className="text-xs font-medium mb-3">
                  최근 24시간 · 잔여 한도
                </h3>
                <HistoryGraph samples={samples} now={now} />
              </div>
              <AlertSettings
                id={account.id}
                value={pref}
                busy={busy}
                onConfigure={onConfigure}
              />
            </article>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        이력은 이 기기에만 저장합니다. 최대 24시간 그래프 · 5분 간격 기록 ·
        감소량은 토큰 수가 아닌 퍼센트포인트입니다. 알림은 앱 안에서 표시됩니다.
      </p>
    </section>
  );
}

export function AlertSettings({
  id,
  value,
  busy,
  onConfigure,
}: {
  id: string;
  value: AlertPreference;
  busy: boolean;
  onConfigure: (id: string, enabled: boolean, threshold: number) => void;
}) {
  return (
    <div className="alert-settings flex flex-wrap items-center gap-3 text-xs">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={value.enabled}
          disabled={busy}
          onChange={(event) =>
            onConfigure(id, event.target.checked, value.threshold)
          }
        />
        한도 부족 앱 내 알림
      </label>
      <label className="flex items-center gap-2">
        알림 기준
        <select
          className="desktop-select"
          aria-label={`${id} 알림 기준`}
          value={value.threshold}
          disabled={busy}
          onChange={(event) =>
            onConfigure(id, value.enabled, Number(event.target.value))
          }
        >
          {[5, 10, 20, 30].map((value) => (
            <option key={value} value={value}>
              잔여 {value}% 이하
            </option>
          ))}
          {![5, 10, 20, 30].includes(value.threshold) && (
            <option value={value.threshold}>
              잔여 {value.threshold}% 이하
            </option>
          )}
        </select>
      </label>
    </div>
  );
}
