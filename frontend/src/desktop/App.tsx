import { QuotaWindow } from "./quota-window";
import { isCurrentObservation } from "./insights-model";
import { MonitorDialogContent as DialogContent } from "./monitor-dialog";
import "./mobile.css";
import { MobileDashboard } from "./mobile-dashboard";
import { MobileNavigation } from "./mobile-navigation";
import { isAndroid } from "./platform";
import { NicknameEditor } from "./nickname-editor";
import { MonitoringInsights, MonitoringSummary } from "./insights";
import { CopyField } from "./components";
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
  const [now, setNow] = useState(() => Date.now() / 1000);
  const checkLogin = useRef<() => Promise<void>>(async () => {});
  const loginGeneration = useRef(0);
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
      setNow(Date.now() / 1000);
    } finally {
      reading.current = false;
    }
  }, []);
  useEffect(() => {
    const load = () => {
      // Freshness/countdowns must advance even when local IPC fails or is pending.
      setNow(Date.now() / 1000);
      void reload().catch((e) => setError(String(e)));
    };
    let timer: ReturnType<typeof setInterval> | undefined;
    const visibility = () => {
      clearInterval(timer);
      if (!document.hidden) {
        load();
        timer = setInterval(load, isAndroid() ? 15000 : 5000);
      }
    };
    visibility();
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", load);
      document.removeEventListener("visibilitychange", visibility);
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
    let active = true;
    const generation = loginGeneration.current;
    void invoke("pending_login")
      .then((value) => {
        if (
          active &&
          generation === loginGeneration.current &&
          value !== null
        ) {
          setDevice(DeviceSchema.parse(value));
          setLoginOpen(true);
        }
      })
      .catch((e) => {
        if (active) setError(String(e));
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!device) return;
    let active = true,
      polling = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      if (polling || !active || document.hidden) return;
      if (Date.now() >= Date.parse(device.expires_at)) {
        setError("로그인 코드가 만료되었습니다. 다시 연결해 주세요.");
        setDevice(null);
        return;
      }
      polling = true;
      clearTimeout(timer);
      try {
        const result = LoginStatusSchema.parse(await invoke("poll_login"));
        if (active && result.status === "connected") {
          setDevice(null);
          setLoginOpen(false);
          setError("");
          setNotice("계정이 연결되었습니다. 사용량 조회로 한도를 확인하세요.");
          await reload();
        } else if (active && result.status === "retrying") {
          setError(result.message);
        } else if (active) {
          setError("");
        }
      } catch (e) {
        // A temporary network/IPC error must not discard an approved login.
        if (active) setError(String(e));
      } finally {
        polling = false;
        if (active && !document.hidden)
          timer = setTimeout(() => void poll(), device.interval_seconds * 1000);
      }
    };
    checkLogin.current = poll;
    const visibility = () => {
      clearTimeout(timer);
      if (!document.hidden) void poll();
    };
    visibility();
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("focus", visibility);
    return () => {
      active = false;
      clearTimeout(timer);
      checkLogin.current = async () => {};
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("focus", visibility);
    };
  }, [device, reload]);
  const accounts = useMemo(() => (data ? projectAccounts(data) : []), [data]);
  async function beginLogin() {
    loginGeneration.current++;
    await perform(async () => {
      setDevice(DeviceSchema.parse(await invoke("start_login")));
      setLoginOpen(true);
    });
  }
  async function cancelLogin() {
    loginGeneration.current++;
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
    <div
      className={`desktop-shell min-h-screen bg-background text-foreground ${isAndroid() ? "android-shell" : ""}`}
    >
      {isAndroid() ? (
        <MobileNavigation
          blurred={blurred}
          dark={theme === "dark"}
          onPrivacy={togglePrivacy}
          onTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
          onAbout={() => setAboutOpen(true)}
        />
      ) : (
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
      )}
      <main className="desktop-main mx-auto max-w-[1200px] space-y-6 px-6 py-8 pb-20">
        <div className="page-heading flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="desktop-title">
              {page === "dashboard"
                ? isAndroid()
                  ? "내 계정"
                  : "대시보드"
                : "계정"}
            </h1>
            <p
              className={`mt-1 text-xs text-muted-foreground ${isAndroid() ? "hidden" : ""}`}
            >
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
              {isAndroid() ? "지금 수집하기" : "사용량 새로고침"}
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
            {page === "dashboard" &&
              (isAndroid() ? (
                <MobileDashboard
                  data={data}
                  now={now}
                  blurred={blurred}
                  busy={busy}
                  onRefresh={(id) => void refreshQuota(id)}
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
              ) : (
                <>
                  <MonitoringSummary data={data} now={now} blurred={blurred} />
                  <MonitoringInsights
                    data={data}
                    now={now}
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
              ))}
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
                  <div className="managed-accounts grid gap-4 lg:grid-cols-2">
                    {accounts.map((a) => {
                      const source = data.accounts.find(
                        (s) => s.id === a.accountId,
                      )!;
                      return (
                        <article
                          key={a.accountId}
                          className={`managed-account space-y-4 rounded-xl border bg-card p-5 ${new URLSearchParams(location.search).get("selected") === a.accountId ? "ring-2 ring-primary/30" : ""}`}
                        >
                          <div className="managed-account-heading">
                            <div>
                              <h2
                                className={`text-sm font-semibold ${blurred ? "blur-sm" : ""}`}
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
                          <NicknameEditor
                            key={`${a.accountId}:${data.account_labels[a.accountId]?.nickname ?? ""}`}
                            nickname={
                              data.account_labels[a.accountId]?.nickname ?? ""
                            }
                            placeholder={source.email || source.account_id}
                            busy={busy}
                            onSave={(nickname) =>
                              perform(async () => {
                                await invoke("set_account_nickname", {
                                  id: a.accountId,
                                  nickname,
                                });
                                setNotice("계정 별명을 저장했습니다.");
                              })
                            }
                          />
                          <div className="managed-quota-grid">
                            {(data.quota_windows[a.accountId] ?? []).map(
                              (window) => (
                                <QuotaWindow
                                  key={window.period}
                                  window={window}
                                  now={now}
                                  muted={
                                    !isCurrentObservation(data, source, now)
                                  }
                                />
                              ),
                            )}
                            {!data.quota_windows[a.accountId]?.length && (
                              <p className="text-sm text-muted-foreground">
                                한도 미확인 · 사용량 조회 후 표시됩니다.
                              </p>
                            )}
                          </div>
                          {data.usage_errors[a.accountId] && (
                            <p
                              role="alert"
                              className="text-sm text-destructive"
                            >
                              조회 실패 · 마지막 관측값을 표시합니다.
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {!source.paused &&
                            source.quota_observed_at &&
                            !isCurrentObservation(data, source, now)
                              ? "이전 관측 · "
                              : "최근 조회: "}
                            {source.quota_observed_at
                              ? new Date(
                                  source.quota_observed_at,
                                ).toLocaleString("ko-KR")
                              : "조회 전"}
                          </p>
                          <div className="managed-account-actions flex gap-2">
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
          {accounts.length}개 계정 ·{" "}
          {isAndroid()
            ? "선택한 자동 조회 설정 적용 · 마지막 관측값"
            : "사용량 자동 조회 60초 · 화면 갱신 5초"}
        </span>
        <span>
          {isAndroid()
            ? "화면을 닫아도 백그라운드 예약 · 절전 시 지연 가능"
            : "창을 닫아도 자동 조회 · 관측 시각 기준"}
        </span>
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
            <p>
              {isAndroid()
                ? "Android 8.0 이상 · ARM64 · 미리보기"
                : `macOS ${minimumMacOS} 이상 · Windows 10/11 (x64)`}{" "}
              · 계정 모니터링
            </p>
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
            <div className="login-content space-y-4">
              <CopyField label="로그인 주소" value={device.verification_url} />
              <CopyField label="인증 코드" value={device.user_code} />
              <p className="text-xs text-muted-foreground">
                만료: {new Date(device.expires_at).toLocaleString("ko-KR")} ·
                브라우저에서 승인한 뒤 이 앱으로 돌아오세요.
              </p>
              <div className="login-actions">
                <Button
                  disabled={busy}
                  onClick={() =>
                    void perform(async () => {
                      await invoke("open_login_page");
                    })
                  }
                >
                  기본 브라우저로 열기
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void checkLogin.current()}
                >
                  연결 상태 다시 확인
                </Button>
              </div>
              <p role="status" className="text-xs text-muted-foreground">
                {error ||
                  "브라우저에 ‘로그인됨’이 표시되면 이 앱으로 돌아와 연결을 확인하세요."}
              </p>
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
              있습니다. 이 기기에 저장된 모니터링 이력은 유지됩니다.
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
