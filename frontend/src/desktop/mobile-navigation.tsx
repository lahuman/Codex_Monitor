import { MonitorDialogContent as DialogContent } from "./monitor-dialog";
import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import {
  Menu,
  LayoutDashboard,
  Users,
  Eye,
  EyeOff,
  Sun,
  Moon,
  Info,
} from "lucide-react";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { MobileControls } from "./mobile-controls";
import appIcon from "../../../desktop/branding/icon.svg";
import { productName } from "./branding";
export function MobileNavigation({
  blurred,
  dark,
  onPrivacy,
  onTheme,
  onAbout,
}: {
  blurred: boolean;
  dark: boolean;
  onPrivacy: () => void;
  onTheme: () => void;
  onAbout: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <header className="mobile-header">
        <Link to="/" className="mobile-brand">
          <img src={appIcon} alt="" />
          <span>{productName}</span>
        </Link>
        <button
          aria-label="메뉴 및 조회 설정"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <Menu size={24} />
        </button>
      </header>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="mobile-menu-panel">
          <DialogHeader>
            <DialogTitle>메뉴 및 조회 설정</DialogTitle>
            <DialogDescription>계정 관리와 휴대폰 수집 설정</DialogDescription>
          </DialogHeader>
          <nav className="mobile-menu-links">
            <NavLink to="/" end onClick={() => setOpen(false)}>
              <LayoutDashboard size={18} />
              대시보드
            </NavLink>
            <NavLink to="/accounts" onClick={() => setOpen(false)}>
              <Users size={18} />
              계정 관리
            </NavLink>
          </nav>
          <MobileControls />
          <div className="mobile-menu-actions">
            <button onClick={onPrivacy}>
              {blurred ? <EyeOff size={18} /> : <Eye size={18} />}이메일{" "}
              {blurred ? "표시" : "가리기"}
            </button>
            <button onClick={onTheme}>
              {dark ? <Sun size={18} /> : <Moon size={18} />}테마 전환
            </button>
            <button
              onClick={() => {
                setOpen(false);
                onAbout();
              }}
            >
              <Info size={18} />앱 정보
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
