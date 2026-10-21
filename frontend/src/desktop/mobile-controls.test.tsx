import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MobileControls } from "./mobile-controls";
import { invoke } from "./data";
vi.mock("./data", () => ({ invoke: vi.fn() }));
const setting = (minutes: number) => ({minutes, background_minutes: minutes === 0 ? null : Math.max(15,minutes), background_state: minutes === 0 ? "disabled" : "scheduled", last_worker_at:null, last_worker_result:null});
afterEach(() => vi.resetAllMocks());
it("restores manual-only, offers exact intervals and persists a selection", async () => {
  vi.mocked(invoke).mockResolvedValueOnce(setting(0)).mockResolvedValueOnce(setting(100));
  render(<MobileControls />);
  const select = await screen.findByRole("combobox");
  await waitFor(() => expect(select).toHaveValue("0"));
  expect(screen.getByText(/자동 수집이 꺼져/)).toBeInTheDocument();
  expect([...select.querySelectorAll("option")].map(x => x.value)).toEqual(["0","1","5","10","30","60","100"]);
  fireEvent.change(select, { target: { value: "100" } });
  await waitFor(() => expect(select).toHaveValue("100"));
  expect(invoke).toHaveBeenCalledWith("set_mobile_interval", { minutes: 100 });
});
it("reports failed saving and retains the saved cadence", async () => {
  vi.mocked(invoke).mockResolvedValueOnce(setting(10)).mockRejectedValueOnce(new Error("저장 실패"));
  render(<MobileControls />);const select = await screen.findByRole("combobox");
  await waitFor(() => expect(select).toHaveValue("10"));fireEvent.change(select,{target:{value:"0"}});
  expect(await screen.findByRole("alert")).toHaveTextContent("저장 실패");expect(select).toHaveValue("10");
});

it("shows the effective background minimum and the last worker outcome", async () => {
  vi.mocked(invoke).mockResolvedValueOnce({...setting(1), last_worker_at: 1792555200, last_worker_result: "completed"});
  render(<MobileControls />);
  expect(await screen.findByText(/앱을 보는 동안 1분 · 백그라운드 15분/)).toBeInTheDocument();
  expect(screen.getByText(/마지막 백그라운드:.*완료/)).toBeInTheDocument();
});
