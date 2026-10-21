import { useEffect, useState } from "react";
import { z } from "zod";
import { invoke } from "./data";
const intervals = [0, 1, 5, 10, 30, 60, 100] as const;
const Setting = z.object({
  minutes: z.number().refine(n => intervals.some(value => value === n)),
  background_minutes: z.number().int().min(15).max(100).nullable(),
  background_state: z.enum(["disabled", "no_accounts", "scheduled"]),
  last_worker_at: z.number().int().nonnegative().nullable(),
  last_worker_result: z.string().nullable(),
});
type Settings = z.infer<typeof Setting>;
const outcomes: Record<string, string> = { running: "수집 중", completed: "완료", query_error: "계정 조회 실패", storage_error: "저장 오류", timeout: "시간 초과", failed: "실행 실패", bridge_error: "실행 준비 실패" };
export function MobileControls() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    const read = () => { if (!document.hidden) void invoke("mobile_settings").then(value => { const parsed = Setting.parse(value); if (active) setSettings(parsed); }).catch(e => { if (active) setError(String(e)); }); };
    let timer: ReturnType<typeof setInterval> | undefined;
    const visibility = () => { clearInterval(timer); if (!document.hidden) { read(); timer = setInterval(read, 60000); } };
    visibility(); document.addEventListener("visibilitychange", visibility);
    return () => { active = false; clearInterval(timer); document.removeEventListener("visibilitychange", visibility); };
  }, []);
  async function change(value: number) {
    setSaving(true); setError("");
    try { setSettings(Setting.parse(await invoke("set_mobile_interval", { minutes: value }))); }
    catch (e) { setError(String(e)); }
    finally { setSaving(false); }
  }
  return <section className="rounded-xl border bg-card p-4 space-y-2" aria-label="휴대폰 자동 조회 설정">
    <div className="flex flex-wrap items-center justify-between gap-3"><label htmlFor="mobile-interval" className="text-sm font-medium">자동 조회 간격</label>
    <select id="mobile-interval" value={settings?.minutes ?? ""} disabled={settings === null || saving} onChange={event => void change(Number(event.target.value))} className="rounded-lg border bg-background px-3 py-2 text-sm">
    {settings === null && <option value="">설정 읽는 중</option>}{intervals.map(value => <option key={value} value={value}>{value === 0 ? "자동 조회 안 함" : `${value}분`}</option>)}
    </select></div>
    <p className="text-xs text-muted-foreground">{settings?.minutes === 0 ? "자동 수집이 꺼져 있습니다. ‘지금 수집하기’를 눌러 새로 조회하세요." : settings ? `앱을 보는 동안 ${settings.minutes}분 · 백그라운드 ${settings.background_minutes ?? Math.max(15, settings.minutes)}분. 네트워크·배터리 상태와 절전 정책에 따라 지연될 수 있습니다.` : "조회 설정을 확인합니다."}</p>
    {settings?.background_state === "no_accounts" && <p className="text-xs text-muted-foreground">활성 계정이 없어 백그라운드 작업을 예약하지 않습니다.</p>}
    {settings && <p className="text-xs text-muted-foreground">마지막 백그라운드: {settings.last_worker_at === null ? "실행 기록 없음" : `${new Date(settings.last_worker_at * 1000).toLocaleString("ko-KR")} · ${outcomes[settings.last_worker_result ?? ""] ?? "결과 미확인"}`}</p>}
    <button type="button" className="text-xs text-primary underline underline-offset-4" onClick={() => { void invoke("pin_widget").catch(e => setError(String(e))); }}>홈 화면 위젯 추가</button>
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
  </section>;
}
