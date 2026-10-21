import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { MobileDashboard } from "./mobile-dashboard";
import type { Snapshot } from "./data";
const now=1900000000;
function snapshot(): Snapshot {
  return {storage_pending:false,accounts:[{id:"work",account_id:"workspace",email:"a-very-long-account-name@example.test",plan:"Team",paused:false,quota:null,quota_observed_at:new Date(now*1000).toISOString()}],account_labels:{work:{nickname:"업무",full:"업무",compact:"업무"}},quota_windows:{work:[{period:"primary",label:"5시간",seconds:18000,remaining:84,reset_at:now+3600},{period:"secondary",label:"주간",seconds:604800,remaining:95,reset_at:now+86400}]},reset_credits:{work:{available_count:2,observed_at:new Date(now*1000).toISOString(),error:null,credits:[{id:"voucher",status:"available",expires_at:new Date((now+3600)*1000).toISOString()}]}},usage_errors:{},history:{},alert_preferences:{},poll_status:{},monitoring_issue:null};
}
function mount(data=snapshot()) {
  const refresh=vi.fn(),configure=vi.fn();
  render(<MemoryRouter><MobileDashboard data={data} now={now} blurred={false} busy={false} onRefresh={refresh} onConfigure={configure}/></MemoryRouter>);
  return {refresh,configure};
}
afterEach(cleanup);
it("shows separate account windows and expiry while history and settings start collapsed",()=>{
  const {refresh}=mount();
  expect(screen.getByRole("heading",{name:"업무"})).toBeVisible();
  expect(screen.getByRole("progressbar",{name:"5시간 잔여"})).toHaveAttribute("aria-valuenow","84");
  expect(screen.getByRole("progressbar",{name:"주간 잔여"})).toHaveAttribute("aria-valuenow","95");
  expect(screen.getByText(/만료 임박/)).toBeVisible();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  const toggle=screen.getByRole("button",{name:/상세 보기/});expect(toggle).toHaveAttribute("aria-expanded","false");
  fireEvent.click(screen.getByRole("button",{name:"업무 사용량 조회"}));expect(refresh).toHaveBeenCalledWith("work");
  fireEvent.click(toggle);expect(toggle).toHaveAttribute("aria-expanded","true");
  expect(screen.getByRole("columnheader",{name:"6시간"})).toBeVisible();
  expect(screen.getByText("최근 24시간")).toBeVisible();
  expect(screen.getByRole("checkbox")).toBeVisible();
});
it("keeps unknown different from zero, and labels stale and failed observations",()=>{
  const data=snapshot();data.quota_windows.work[0].remaining=null;data.quota_windows.work[1].remaining=0;
  data.accounts[0].quota_observed_at=new Date((now-1200)*1000).toISOString();data.usage_errors.work="fixture offline";data.reset_credits.work.observed_at=new Date((now-1200)*1000).toISOString();
  mount(data);
  expect(screen.getByRole("progressbar",{name:"5시간 잔여"})).not.toHaveAttribute("aria-valuenow");
  expect(screen.getByRole("progressbar",{name:"주간 잔여"})).toHaveAttribute("aria-valuenow","0");
  expect(screen.getByText(/20분 전 관측 · 오래됨/)).toBeVisible();
  expect(screen.getByText("조회 실패")).toBeVisible();
  expect(screen.queryByText(/만료 임박/)).not.toBeInTheDocument();
});
it("provides account management for an empty phone without invented usage",()=>{
  const data=snapshot();data.accounts=[];mount(data);
  expect(screen.getByRole("link",{name:"계정 관리로 이동"})).toHaveAttribute("href","/accounts");
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
});
