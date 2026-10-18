import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { resetCreditView } from "./reset-credits-model";
import { duration } from "./insights-model";
import type { ResetCreditObservation } from "./data";

export function ResetCreditsPanel({
  observation,
  now,
  paused,
  compact = false,
}: {
  observation: ResetCreditObservation | undefined;
  now: number;
  paused: boolean;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const count = observation?.available_count;
  const at = observation?.observed_at;
  const view = resetCreditView(observation, now, paused);
  const credits = view.credits;
  const limit = 1;
  const visible = expanded ? credits : credits.slice(0, limit);
  const toggle =
    credits.length > limit ? (
      <button
        type="button"
        className="reset-credit-expand"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? "접기" : `만료일 전체 보기 (${credits.length}개)`}
      </button>
    ) : null;
  const warningLabel =
    view.warning?.level === "urgent" ? "만료 임박" : "만료 주의";
  const warningDescription = view.warning
    ? `초기화권 ${warningLabel} · 7일 미만 ${view.warning.count}개 · 24시간 이하 ${view.warning.urgentCount}개`
    : undefined;
  return (
    <section
      className={`reset-credit-panel ${compact ? "reset-credit-compact" : ""} ${view.warning ? `reset-credit-attention-${view.warning.level}` : ""}`}
      aria-label="초기화권"
    >
      <div className="reset-credit-heading">
        <h3>
          초기화권 <strong>{count == null ? "미확인" : `${count}개`}</strong>
        </h3>
        {compact && (
          <div className="reset-credit-actions">
            {view.warning && (
              <span
                role="status"
                aria-label={warningDescription}
                title={warningDescription}
                className={`reset-credit-badge reset-credit-badge-${view.warning.level}`}
              >
                {warningLabel}
              </span>
            )}
            {toggle}
          </div>
        )}
        {(!compact || view.state !== "fresh") && (
          <span className="reset-credit-state">
            {view.state === "paused"
              ? "모니터링 정지 · 마지막 관측"
              : view.state === "stale"
                ? "오래된 관측 · 갱신 필요"
                : view.state === "unknown"
                  ? "조회 시각 미확인"
                  : "사용 가능 수량"}
          </span>
        )}
      </div>
      {view.warning && !compact && (
        <p
          className={`reset-credit-warning reset-credit-warning-${view.warning.level}`}
        >
          <TriangleAlert aria-hidden="true" size={14} />
          <span>
            {view.warning.level === "urgent" ? "만료 임박" : "만료 주의"}
            {" · "}초기화권 {view.warning.count}개가 7일 미만으로 남았습니다.
            {view.warning.urgentCount > 0 &&
              ` 이 중 ${view.warning.urgentCount}개는 24시간 이하입니다.`}
          </span>
        </p>
      )}
      {at != null && !compact && (
        <p className="reset-credit-observed">
          최근 조회:{" "}
          <time dateTime={at}>{new Date(at).toLocaleString("ko-KR")}</time>
        </p>
      )}
      {count === 0 && <p>사용 가능한 초기화권이 없습니다.</p>}
      {visible.length > 0 && (
        <ul className="reset-credit-dates" aria-label="초기화권 만료일">
          {visible.map((credit) => (
            <li key={credit.id}>
              {!compact && (
                <span className="reset-credit-item-label">
                  1개
                  {credit.warning && (
                    <b
                      className={`reset-credit-badge reset-credit-badge-${credit.warning}`}
                    >
                      {credit.warning === "urgent" ? "만료 임박" : "만료 주의"}
                    </b>
                  )}
                </span>
              )}
              {credit.expires_at == null ? (
                <span>만료일 미제공</span>
              ) : (
                <span>
                  <time dateTime={credit.expires_at}>
                    {new Date(credit.expires_at).toLocaleString(
                      "ko-KR",
                      compact
                        ? {
                            year: "numeric",
                            month: "numeric",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        : undefined,
                    )}
                  </time>
                  <span className="reset-credit-remaining">
                    {credit.remainingSeconds != null &&
                    credit.remainingSeconds <= 0
                      ? "만료 시각 경과 · 갱신 필요"
                      : `${duration(credit.remainingSeconds!)} 후 만료`}
                  </span>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {!compact && toggle}
      {view.missingDetails && (
        <p>만료일 미확인 · 상세 정보를 확인하지 못했습니다.</p>
      )}
      {view.inconsistentCount && (
        <p role="status">수량·상세 내역 불일치 · 갱신 필요</p>
      )}
      {observation?.error && (
        <p role="status" className="text-destructive">
          초기화권 상세 조회 실패 · {observation.error}
        </p>
      )}
      {!compact && credits.some((c) => c.expires_at != null) && (
        <p className="reset-credit-observed">
          만료일은 이 기기의 시간대로 표시합니다. · 7일 미만 주의 / 24시간 이하
          임박
        </p>
      )}
    </section>
  );
}
