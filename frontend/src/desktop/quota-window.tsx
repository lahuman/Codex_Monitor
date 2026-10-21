import { Clock3 } from "lucide-react";
import type { ObservedWindow } from "./data";
import { duration, quotaTone } from "./insights-model";

export function QuotaWindow({
  window,
  now,
  muted,
}: {
  window: ObservedWindow;
  now: number;
  muted: boolean;
}) {
  const value = window.remaining;
  const tone = quotaTone(value, muted);
  return (
    <div className={`quota-window quota-tone-${tone}`}>
      <div className="quota-window-heading">
        <span>
          {window.label}
          <small className="quota-remaining-label"> 잔여</small>
        </span>
        <strong>
          {value == null ? (
            "—"
          ) : (
            <>
              {value}
              <small>%</small>
            </>
          )}
        </strong>
      </div>
      <div
        className="quota-bar-track"
        role="progressbar"
        aria-label={`${window.label} 잔여`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value ?? undefined}
        aria-valuetext={value == null ? "미확인" : `${value}%`}
      >
        <span style={{ width: `${value ?? 0}%` }} />
      </div>
      <p className="quota-reset">
        <Clock3 aria-hidden="true" size={12} />
        {window.reset_at == null
          ? "초기화 시각 미확인"
          : window.reset_at <= now
            ? "초기화 확인 필요"
            : `${duration(window.reset_at - now)} 후`}
      </p>
    </div>
  );
}
