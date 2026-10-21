import { QuotaWindow } from "./quota-window";
import { useId, useState } from "react";
import { ChevronDown, RefreshCw, Ticket, Users } from "lucide-react";
import { Link } from "react-router-dom";
import type { Snapshot } from "./data";
import {
  accountSamples,
  isCurrentObservation,
  duration,
  health,
  intervalUsage,
  observedSeconds,
  preference,
} from "./insights-model";
import { AlertSettings, HistoryGraph } from "./insights";
import { resetCreditView } from "./reset-credits-model";
import { ResetCreditsPanel } from "./reset-credits";

type Props = {
  data: Snapshot;
  now: number;
  blurred: boolean;
  busy: boolean;
  onRefresh: (id: string) => void;
  onConfigure: (id: string, enabled: boolean, threshold: number) => void;
};
function MobileAccount({
  account,
  data,
  now,
  blurred,
  busy,
  onRefresh,
  onConfigure,
}: Props & { account: Snapshot["accounts"][number] }) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const state = health(data, account, now);
  const at = observedSeconds(account);
  const error = data.usage_errors[account.id];
  const windows = data.quota_windows[account.id] ?? [];
  const observed = isCurrentObservation(data, account, now);
  const status = account.paused
    ? "일시 정지"
    : error
      ? "조회 실패"
      : state === "정상"
        ? "활성"
        : state === "부족"
          ? "주의"
          : state;
  const nickname = data.account_labels[account.id]?.nickname;
  const name =
    data.account_labels[account.id]?.full ||
    account.email ||
    account.account_id;
  const credit = data.reset_credits[account.id];
  const vouchers = resetCreditView(credit, now, account.paused);
  const nearest = vouchers.credits.find(
    (c) => c.remainingSeconds != null && c.remainingSeconds > 0,
  );
  const pref = preference(data, account.id);
  const low =
    observed &&
    !account.paused &&
    pref.enabled &&
    windows.some((w) => w.remaining != null && w.remaining <= pref.threshold);
  return (
    <article className="mobile-account-card" aria-label={`${name} 모니터링`}>
      <header className="mobile-card-header">
        <div className="mobile-account-identity">
          <h2 className={blurred ? "blur-sm" : ""}>{name}</h2>
          <p>
            {account.plan ?? "플랜 미확인"}
            {nickname && (
              <span className={blurred ? "blur-sm" : ""}>
                {" "}
                · {account.email || account.account_id}
              </span>
            )}
          </p>
        </div>
        <span
          className={`mobile-account-status ${error ? "is-error" : account.paused || !observed ? "is-muted" : state === "소진" ? "is-error" : state === "부족" ? "is-warning" : ""}`}
        >
          <i />
          {status}
        </span>
      </header>
      <div className="mobile-quota-grid">
        {windows.length ? (
          windows.map((window) => (
            <QuotaWindow
              key={window.period}
              window={window}
              now={now}
              muted={!observed || account.paused || !!error}
            />
          ))
        ) : (
          <p className="mobile-empty-quota">
            한도 미확인 · 수집 후 표시됩니다.
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className="mobile-card-warning">
          사용량 조회 실패 · 마지막 관측값을 표시합니다.
        </p>
      )}
      {low && (
        <p role="status" className="mobile-card-warning">
          잔여 한도 알림 · 설정 기준 {pref.threshold}% 이하
        </p>
      )}
      <div
        className={`mobile-voucher-line ${vouchers.warning ? `is-${vouchers.warning.level}` : ""}`}
      >
        <Ticket size={14} aria-hidden="true" />
        <span>
          초기화권{" "}
          <strong>
            {credit?.available_count == null
              ? "미확인"
              : `${credit.available_count}개`}
          </strong>
        </span>
        {vouchers.warning ? (
          <span className="mobile-voucher-expiry">
            {vouchers.warning.level === "urgent" ? "만료 임박" : "만료 주의"} ·{" "}
            {duration(vouchers.warning.nearest.remainingSeconds!)} 후
          </span>
        ) : (
          credit?.available_count != null &&
          credit.available_count !== 0 && (
            <span className="mobile-voucher-expiry">
              {nearest
                ? `${duration(nearest.remainingSeconds!)} 후 만료`
                : "만료일 미확인"}
              {vouchers.state !== "fresh" ? " · 이전 관측" : ""}
            </span>
          )
        )}
      </div>
      <div className="mobile-card-footer">
        <button
          className="mobile-detail-toggle"
          aria-expanded={expanded}
          aria-controls={detailsId}
          onClick={() => setExpanded(!expanded)}
        >
          상세 {expanded ? "접기" : "보기"}
          <ChevronDown size={15} className={expanded ? "is-open" : ""} />
        </button>
        <span className="mobile-observed">
          {at == null
            ? "조회 전"
            : now < at
              ? "조회 시각 확인 필요"
              : now - at < 1
                ? "방금 관측"
                : `${duration(now - at)} 전 관측`}
          {at != null && now - at > 120 ? " · 오래됨" : ""}
        </span>
        <button
          className="mobile-refresh"
          aria-label={`${name} 사용량 조회`}
          disabled={busy || account.paused}
          onClick={() => onRefresh(account.id)}
        >
          <RefreshCw size={15} className={busy ? "animate-spin" : ""} />
          <span>조회</span>
        </button>
      </div>
      {expanded && (
        <div id={detailsId} className="mobile-account-details">
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          {at != null && (
            <p className="mobile-detail-note">
              마지막 관측{" "}
              <time dateTime={new Date(at * 1000).toISOString()}>
                {new Date(at * 1000).toLocaleString("ko-KR")}
              </time>
            </p>
          )}
          <ResetCreditsPanel
            observation={credit}
            now={now}
            paused={account.paused}
            compact
          />
          <h3>
            최근 사용량 <small>관측 한도 감소 · %p</small>
          </h3>
          <div className="mobile-usage-table">
            <table>
              <thead>
                <tr>
                  <th scope="col">기간</th>
                  {[1, 3, 6].map((h) => (
                    <th key={h} scope="col">
                      {h}시간
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {windows.map((w) => (
                  <tr key={w.period}>
                    <th scope="row">{w.label}</th>
                    {[1, 3, 6].map((h) => {
                      const usage = intervalUsage(
                        accountSamples(data, account),
                        w.period,
                        now,
                        h,
                      );
                      return (
                        <td key={h} title={usage.reason ?? undefined}>
                          {usage.value == null
                            ? "—"
                            : `${usage.value.toFixed(1)}`}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mobile-detail-note">
            — 관측 기록 부족 또는 초기화 구간 · 실제 토큰 수가 아닙니다.
          </p>
          <h3>
            최근 24시간 <small>잔여 한도</small>
          </h3>
          <HistoryGraph samples={accountSamples(data, account)} now={now} />
          <div className="mobile-reset-dates">
            {windows.map((w) => (
              <p key={w.period}>
                {w.label} 초기화{" "}
                <span>
                  {w.reset_at == null
                    ? "미확인"
                    : new Date(w.reset_at * 1000).toLocaleString("ko-KR")}
                </span>
              </p>
            ))}
          </div>
          <AlertSettings
            id={account.id}
            value={pref}
            busy={busy}
            onConfigure={onConfigure}
          />
        </div>
      )}
    </article>
  );
}
export function MobileDashboard(props: Props) {
  const { data, now } = props;
  const active = data.accounts.filter((a) => !a.paused).length;
  const attention = data.accounts.filter(
    (a) =>
      ["부족", "소진"].includes(health(data, a, now)) ||
      !!data.usage_errors[a.id] ||
      !!resetCreditView(data.reset_credits[a.id], now, a.paused).warning,
  ).length;
  return (
    <section className="mobile-dashboard" aria-label="모바일 계정 대시보드">
      <div className="mobile-account-summary">
        <span>ACCOUNTS</span>
        <span>
          <b>{data.accounts.length}</b> 등록
        </span>
        <span>
          <b>{active}</b> 활성
        </span>
        <span className={attention ? "has-attention" : ""}>
          <b>{attention}</b> 주의
        </span>
      </div>
      {data.monitoring_issue && (
        <p role="alert" className="mobile-card-warning">
          {data.monitoring_issue}
        </p>
      )}
      {!data.accounts.length ? (
        <div className="mobile-empty">
          <Users size={28} />
          <h2>계정을 연결해 시작하세요</h2>
          <p>잔여 한도와 초기화 시간을 한곳에서 확인합니다.</p>
          <Link to="/accounts">계정 관리로 이동</Link>
        </div>
      ) : (
        <div className="mobile-account-list">
          {data.accounts.map((account) => (
            <MobileAccount key={account.id} {...props} account={account} />
          ))}
        </div>
      )}
    </section>
  );
}
