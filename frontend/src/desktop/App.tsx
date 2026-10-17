import { MonitoringInsights, MonitoringSummary } from "./insights";
import { QuotaChart, CopyField } from "./components";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  Users,
  RefreshCw,
  Plus,
  Sun,
  Moon,
  Eye,
  EyeOff,
  Info,
} from "lucide-react";
import appIcon from "../../../desktop/branding/icon.svg";
import { productName, productVersion, minimumMacOS } from "./branding";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useThemeStore } from "@/hooks/use-theme";
import { usePrivacyStore } from "@/hooks/use-privacy";
import {
  LoginStatusSchema,
  DeviceSchema,
  SnapshotSchema,
  invoke,
  listenOperationError,
  projectAccounts,
  type Device,
  type Snapshot,
} from "./data";

export function DesktopApp() {
  const [aboutOpen, setAboutOpen] = useState(false);
  const [data, setData] = useState<Snapshot | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [observedAt, setObservedAt] = useState(0);
  const [device, setDevice] = useState<Device | null>(null),
    [loginOpen, setLoginOpen] = useState(false),
    [deleteId, setDeleteId] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null),
    reading = useRef(false),
    action = useRef(false);
  const location = useLocation();
  const page = location.pathname === "/accounts" ? "accounts" : "dashboard";
  const theme = useThemeStore((s) => s.theme),
    setTheme = useThemeStore((s) => s.setTheme),
    blurred = usePrivacyStore((s) => s.blurred),
    togglePrivacy = usePrivacyStore((s) => s.toggle);
  const reload = useCallback(async () => {
    if (reading.current) return;
    reading.current = true;
    try {
      const raw = await invoke("dashboard");
      setData(SnapshotSchema.parse(raw));
      setObservedAt(Date.now());
    } finally {
      reading.current = false;
    }
  }, []);
  useEffect(() => {
    const load = () => void reload().catch((e) => setError(String(e)));
    load();
    const timer = setInterval(() => {
      if (!document.hidden) load();
    }, 5000);
    window.addEventListener("focus", load);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [reload]);
  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listenOperationError(setError)
      .then((stop) => {
        if (disposed) stop();
        else unlisten = stop;
      })
      .catch((e) => setError(String(e)));
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);
  async function perform(fn: () => Promise<void>) {
    if (action.current) return;
    action.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      await reload();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
      action.current = false;
    }
  }
  useEffect(() => {
    if (!device) return;
    let active = true,
      polling = false;
    const poll = async () => {
      if (polling) return;
      polling = true;
      try {
        const result = LoginStatusSchema.parse(await invoke("poll_login"));
        if (active && result.status === "connected") {
          setDevice(null);
          setLoginOpen(false);
          setNotice("계정이 연결되었습니다. 사용량 조회로 한도를 확인하세요.");
          await reload();
        }
      } catch (e) {
        if (active) {
          setError(String(e));
          setDevice(null);
        }
      } finally {
        polling = false;
      }
    };
    const timer = setInterval(
      () => void poll(),
      device.interval_seconds * 1000,
    );
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [device, reload]);
  const accounts = useMemo(() => (data ? projectAccounts(data) : []), [data]);
  async function beginLogin() {
    await perform(async () => {
      setDevice(DeviceSchema.parse(await invoke("start_login")));
      setLoginOpen(true);
    });
  }
  async function cancelLogin() {
    await perform(async () => {
      await invoke("cancel_login");
      setDevice(null);
      setLoginOpen(false);
    });
  }
  async function refreshQuota(id?: string) {
    await perform(async () => {
      const selected = id
          ? [id]
          : (data?.accounts.filter((a) => !a.paused).map((a) => a.id) ?? []),
        failed: string[] = [];
      for (const id of selected) {
        try {
          await invoke("refresh_usage", { id });
        } catch (e) {
          failed.push(
            `${accounts.find((a) => a.accountId === id)?.displayName ?? id}: ${String(e)}`,
          );
        }
      }
      await reload();
      if (failed.length) throw new Error(failed.join("\n"));
      setNotice(
        selected.length
          ? "계정 한도를 갱신했습니다."
          : "먼저 계정을 연결하세요.",
      );
    });
  }

  return (
    <div className="desktop-shell min-h-screen bg-background text-foreground">
      <header className="desktop-header sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-4 px-6 py-4">
          <Link
            to="/"
            className="flex flex-1 items-center gap-2 text-sm font-semibold"
          >
            <img src={appIcon} alt="" className="size-10" />
            {productName}
          </Link>
          <nav className="flex items-center rounded-lg bg-muted p-1">
            {[
              ["/", "대시보드"],
              ["/accounts", "계정"],
            ].map(([to, label]) => (
              <NavLink
                key={to}
                to={to}
                end
                className={({ isActive }) =>
                  `rounded-md px-4 py-1.5 text-xs font-medium ${isActive ? "bg-background shadow-sm" : "text-muted-foreground"}`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="flex flex-1 justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="앱 정보"
              onClick={() => setAboutOpen(true)}
            >
              <Info />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="이메일 가리기"
              onClick={togglePrivacy}
            >
              {blurred ? <EyeOff /> : <Eye />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="테마 전환"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun /> : <Moon />}
            </Button>
          </div>
        </div>
      </header>
      <main className="desktop-main mx-auto max-w-[1200px] space-y-6 px-6 py-8 pb-20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="desktop-title">
              {page === "dashboard" ? "대시보드" : "계정"}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {page === "dashboard"
                ? "계정별 잔여 한도와 초기화 시간을 확인하세요."
                : "계정 연결과 사용량을 앱 안에서 관리합니다."}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void refreshQuota()}
            >
              <RefreshCw className={busy ? "animate-spin" : ""} />
              사용량 새로고침
            </Button>
            {page === "accounts" && (
              <Button
                size="sm"
                disabled={busy || !!device}
                onClick={() => void beginLogin()}
              >
                <Plus />
                계정 연결
              </Button>
            )}
          </div>
        </div>
        {(error || data?.storage_pending) && (
          <div
            role="alert"
            className="whitespace-pre-wrap break-words rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
          >
            {error || "저장 실패: 디스크 공간과 접근 권한을 확인하세요."}
          </div>
        )}
        {notice && (
          <p role="status" className="text-sm text-muted-foreground">
            {notice}
          </p>
        )}
        {!data ? (
          <div className="rounded-xl border p-12 text-center text-sm text-muted-foreground">
            대시보드 데이터를 불러오는 중…{" "}
            <Button variant="link" onClick={() => void perform(reload)}>
              다시 시도
            </Button>
          </div>
        ) : (
          <>
            {page === "dashboard" && (
              <>
                <MonitoringSummary
                  data={data}
                  now={observedAt / 1000}
                  blurred={blurred}
                />
                <MonitoringInsights
                  data={data}
                  now={observedAt / 1000}
                  blurred={blurred}
                  busy={busy}
                  onConfigure={(id, enabled, threshold) =>
                    void perform(async () => {
                      await invoke("configure_alert", {
                        id,
                        enabled,
                        threshold,
                      });
                      setNotice("알림 설정을 저장했습니다.");
                    })
                  }
                />
              </>
            )}
            {page === "accounts" && (
              <>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => file.current?.click()}
                  >
                    auth.json 가져오기
                  </Button>
                  <input
                    ref={file}
                    type="file"
                    accept=".json,application/json"
                    hidden
                    onChange={(e) => {
                      const chosen = e.target.files?.[0];
                      e.target.value = "";
                      if (chosen)
                        void perform(async () => {
                          if (chosen.size > 1024 * 1024)
                            throw new Error(
                              "인증 파일은 1 MiB 이하여야 합니다.",
                            );
                          await invoke("import_account", {
                            raw: await chosen.text(),
                          });
                          setNotice(
                            "계정을 가져왔습니다. 한도를 조회해 인증 상태를 확인하세요.",
                          );
                        });
                    }}
                  />
                </div>
                {!accounts.length ? (
                  <div className="rounded-xl border p-10 text-center">
                    <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                    <h2 className="text-sm font-medium">
                      연결된 계정이 없습니다
                    </h2>
                    <p className="mt-2 text-xs text-muted-foreground">
                      계정 연결 또는 auth.json 가져오기를 사용하세요.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {accounts.map((a) => {
                      const source = data.accounts.find(
                        (s) => s.id === a.accountId,
                      )!;
                      return (
                        <article
                          key={a.accountId}
                          className={`space-y-4 rounded-xl border bg-card p-5 ${new URLSearchParams(location.search).get("selected") === a.accountId ? "ring-2 ring-primary/30" : ""}`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h2
                                className={`text-sm font-semibold ${blurred && a.email ? "blur-sm" : ""}`}
                              >
                                {a.displayName}
                              </h2>
                              <p className="text-xs text-muted-foreground">
                                {a.planType} ·{" "}
                                {source.paused ? "일시 정지" : "활성"}
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy || source.paused}
                              onClick={() => void refreshQuota(a.accountId)}
                            >
                              사용량 조회
                            </Button>
                          </div>
                          <div className="space-y-3">
                            {(["primary", "secondary", "monthly"] as const)
                              .filter((period) =>
                                period === "primary"
                                  ? a.windowMinutesPrimary != null
                                  : period === "secondary"
                                    ? a.windowMinutesSecondary != null
                                    : a.windowMinutesMonthly != null,
                              )
                              .map((period) => (
                                <QuotaChart
                                  key={period}
                                  accounts={[a]}
                                  period={period}
                                />
                              ))}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            최근 조회:{" "}
                            {source.quota_observed_at
                              ? new Date(
                                  source.quota_observed_at,
                                ).toLocaleString("ko-KR")
                              : "조회 전"}
                          </p>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onClick={() =>
                                void perform(async () => {
                                  await invoke("change_account", {
                                    id: a.accountId,
                                    remove: false,
                                    paused: !source.paused,
                                  });
                                })
                              }
                            >
                              {source.paused ? "재개" : "일시 정지"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={busy}
                              onClick={() => setDeleteId(a.accountId)}
                            >
                              연결 해제
                            </Button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>
      <footer className="desktop-footer fixed bottom-0 z-10 flex w-full items-center justify-between border-t bg-background px-6 py-2 text-[11px] text-muted-foreground">
        <span>
          {accounts.length}개 계정 · 사용량 자동 조회 60초 · 화면 갱신 5초
        </span>
        <span>창을 닫아도 자동 조회 · 관측 시각 기준</span>
      </footer>
      <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
        <DialogContent className="sm:max-w-sm" showCloseButton={false}>
          <DialogHeader className="items-center text-center sm:text-center">
            <img src={appIcon} alt="" className="size-24" />
            <DialogTitle className="text-xl">{productName}</DialogTitle>
            <DialogDescription>
              계정별 한도와 초기화권을 한눈에 확인하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="text-center text-xs text-muted-foreground space-y-2">
            <p>버전 {productVersion}</p>
            <p>기반 프로젝트: codex-lb · MIT</p>
            <p>macOS {minimumMacOS} 이상 · Windows 10/11 (x64) · 계정 모니터링</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAboutOpen(false)}>
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={loginOpen}
        onOpenChange={(open) => {
          if (!open) void cancelLogin();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>계정 연결</DialogTitle>
            <DialogDescription>
              주소를 복사해 Chrome 등 원하는 브라우저에서 열고, 인증 코드를
              입력하세요.
            </DialogDescription>
          </DialogHeader>
          {device && (
            <div className="space-y-4">
              <CopyField label="로그인 주소" value={device.verification_url} />
              <CopyField label="인증 코드" value={device.user_code} />
              <p className="text-xs text-muted-foreground">
                만료: {new Date(device.expires_at).toLocaleString("ko-KR")} ·
                승인 후 자동 연결됩니다.
              </p>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void perform(async () => {
                    await invoke("open_login_page");
                  })
                }
              >
                기본 브라우저로 열기
              </Button>
            </div>
          )}
          {!device && (
            <p className="text-sm text-muted-foreground">
              로그인 코드가 만료되었거나 인증을 완료하지 못했습니다.
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void cancelLogin()}
            >
              닫기 · 로그인 취소
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>계정 연결을 해제할까요?</DialogTitle>
            <DialogDescription>
              이 앱에 저장된 계정 연결을 제거합니다. 다시 로그인해 연결할 수
              있습니다. 이 Mac에 저장된 모니터링 이력은 유지됩니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              취소
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() =>
                void perform(async () => {
                  await invoke("change_account", {
                    id: deleteId,
                    remove: true,
                    paused: false,
                  });
                  setDeleteId(null);
                })
              }
            >
              연결 해제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
