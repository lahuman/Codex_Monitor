import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AccountView } from "./data";
export function QuotaMeter({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  return (
    <div
      className="quota-meter"
      role="img"
      aria-label={`${label} 잔여 ${value == null ? "미확인" : `${value}%`}`}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="42" className="quota-track" />
        {value != null && (
          <circle
            cx="50"
            cy="50"
            r="42"
            pathLength="100"
            strokeDasharray={`${value} 100`}
            transform="rotate(-90 50 50)"
            className="quota-fill"
          />
        )}
      </svg>
      <span>
        {value == null ? (
          "—"
        ) : (
          <>
            {value}
            <small>%</small>
          </>
        )}
      </span>
    </div>
  );
}
export function QuotaLegend() {
  return (
    <ul className="quota-legend" aria-label="한도 범례">
      <li>
        <i className="legend-remaining" />
        잔여
      </li>
      <li>
        <i className="legend-used" />
        사용
      </li>
    </ul>
  );
}
export function QuotaChart({
  accounts,
  period = "primary",
}: {
  accounts: AccountView[];
  period?: "primary" | "secondary" | "monthly";
}) {
  const label = { primary: "5시간", secondary: "주간", monthly: "월간" }[
    period
  ];
  return (
    <section className="quota-tile">
      {accounts.map((account) => {
        const value =
          period === "monthly"
            ? account.usage?.monthlyRemainingPercent
            : period === "secondary"
              ? account.usage?.secondaryRemainingPercent
              : account.usage?.primaryRemainingPercent;
        return (
          <div key={account.accountId} className="quota-tile-body">
            <QuotaMeter label={label} value={value ?? null} />
            <div>
              <h3>
                {label} · 잔여 {value == null ? "—" : `${value}%`}
              </h3>
              <QuotaLegend />
            </div>
          </div>
        );
      })}
    </section>
  );
}
export function CopyField({ label, value }: { label: string; value: string }) {
  const field = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState("");
  async function copy() {
    field.current?.focus();
    field.current?.select();
    try {
      await navigator.clipboard.writeText(value);
      setNotice("복사했습니다.");
    } catch {
      setNotice("⌘C 또는 Ctrl+C로 복사해 주세요.");
    }
  }
  return (
    <div className="space-y-2">
      <label className="grid gap-2 text-xs">
        {label}
        <div className="flex gap-2">
          <Input
            ref={field}
            value={value}
            readOnly
            className="font-mono text-xs"
          />
          <Button variant="outline" size="sm" onClick={() => void copy()}>
            복사
          </Button>
        </div>
      </label>
      {notice && (
        <p role="status" className="text-xs text-muted-foreground">
          {notice}
        </p>
      )}
    </div>
  );
}
