import { useState } from "react";
import type { ResetCreditObservation } from "./data";

export function ResetCreditsPanel({
  observation,
  now,
  paused,
}: {
  observation: ResetCreditObservation | undefined;
  now: number;
  paused: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const count = observation?.available_count;
  const at = observation?.observed_at;
  const stale = at != null && now - Date.parse(at) / 1000 > 120;
  const credits = (observation?.credits ?? [])
    .filter((c) => c.status === "available")
    .toSorted((a, b) => {
      if (a.expires_at == null) return b.expires_at == null ? 0 : 1;
      if (b.expires_at == null) return -1;
      return Date.parse(a.expires_at) - Date.parse(b.expires_at);
    });
  const visible = expanded ? credits : credits.slice(0, 5);
  return (
    <section className="reset-credit-panel" aria-label="초기화권">
      <div className="reset-credit-heading">
        <h3>
          초기화권 <strong>{count == null ? "미확인" : `${count}개`}</strong>
        </h3>
        <span>
          {paused
            ? "모니터링 정지 · 마지막 관측"
            : stale
              ? "오래된 관측 · 갱신 필요"
              : "사용 가능 수량"}
        </span>
      </div>
      {at != null && (
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
              <span>1개</span>
              {credit.expires_at == null ? (
                <span>만료일 미제공</span>
              ) : (
                <span>
                  <time dateTime={credit.expires_at}>
                    {new Date(credit.expires_at).toLocaleString("ko-KR")}
                  </time>
                  {Date.parse(credit.expires_at) / 1000 <= now
                    ? " · 만료 시각 경과 · 갱신 필요"
                    : " 만료"}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {credits.length > 5 && (
        <button
          type="button"
          className="reset-credit-expand"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "접기" : `만료일 전체 보기 (${credits.length}개)`}
        </button>
      )}
      {count !== 0 &&
        (observation?.credits == null ||
          (count != null && credits.length < count)) && (
          <p>만료일 미확인 · 상세 정보를 확인하지 못했습니다.</p>
        )}
      {observation?.error && (
        <p role="status" className="text-destructive">
          초기화권 상세 조회 실패 · {observation.error}
        </p>
      )}
      {credits.some((c) => c.expires_at != null) && (
        <p className="reset-credit-observed">
          만료일은 이 Mac의 시간대로 표시합니다.
        </p>
      )}
    </section>
  );
}
