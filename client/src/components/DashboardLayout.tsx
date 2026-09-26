import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  Archive,
  BookOpenCheck,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  ShoppingCart,
  UsersRound,
} from "lucide-react";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

const menuItems = [
  { icon: LayoutDashboard, label: "Visão geral", path: "/" },
  { icon: UsersRound, label: "Alunos e matrículas", path: "/alunos" },
  { icon: Archive, label: "Estoque", path: "/estoque" },
  { icon: ShoppingCart, label: "Vendas", path: "/vendas" },
  { icon: ClipboardList, label: "Anotações", path: "/anotacoes" },
];

const SIDEBAR_WIDTH_KEY = "school-sidebar-width";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : 252;
  });
  const { loading, user } = useAuth();
  useEffect(() => localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString()), [sidebarWidth]);
  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) return <div className="grid min-h-screen place-items-center bg-[#f7f7f3] p-6"><div className="w-full max-w-md rounded-3xl bg-[#fffefb] p-8 text-center shadow-[0_16px_60px_rgba(26,54,73,.1)]"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#12233f] text-white"><GraduationCap className="h-7 w-7" /></div><p className="mt-6 text-[10px] font-bold uppercase tracking-[.2em] text-[#14877e]">Colégio Gestão</p><h1 className="mt-2 font-display text-2xl font-bold text-[#12233f]">Acesse o painel da escola</h1><p className="mt-3 text-sm leading-6 text-[#7c8994]">Entre com sua conta para gerenciar alunos, matrículas, estoque e anotações.</p><Button onClick={() => startLogin()} className="mt-7 h-11 w-full rounded-xl bg-[#12233f] text-xs font-bold text-white hover:bg-[#203b60]">Entrar no sistema <LogIn className="ml-2 h-4 w-4" /></Button></div></div>;
  return (
    <div className="min-h-screen bg-[#f7f7f3] text-[#12233f]">
      <DashboardLayoutContent collapsed={collapsed} setCollapsed={setCollapsed} sidebarWidth={sidebarWidth} setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </div>
  );
}

function DashboardLayoutContent({
  children,
  collapsed,
  setCollapsed,
  sidebarWidth,
  setSidebarWidth,
}: {
  children: React.ReactNode;
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
  sidebarWidth: number;
  setSidebarWidth: (value: number) => void;
}) {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [resizing, setResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const activeItem = menuItems.find(item => item.path === location) ?? menuItems[0];

  useEffect(() => {
    const move = (event: MouseEvent) => {
      if (!resizing || collapsed) return;
      const left = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      setSidebarWidth(Math.min(340, Math.max(220, event.clientX - left)));
    };
    const up = () => setResizing(false);
    if (resizing) {
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [collapsed, resizing, setSidebarWidth]);

  const navigate = (path: string) => {
    setLocation(path);
    setMobileOpen(false);
  };

  return (
    <div className="flex min-h-screen">
      {isMobile && mobileOpen && <button aria-label="Fechar menu" className="fixed inset-0 z-40 bg-[#12233f]/25 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />}
      <aside
        ref={sidebarRef}
        style={{ width: isMobile ? 272 : collapsed ? 76 : sidebarWidth }}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-[#dfe4e5] bg-[#fffefb] transition-[width,transform] duration-200",
          isMobile && !mobileOpen && "-translate-x-full",
          isMobile && mobileOpen && "translate-x-0",
        )}
      >
        <div className="flex h-[86px] items-center gap-3 border-b border-[#edf0ef] px-5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#12233f] text-white shadow-[0_8px_20px_rgba(18,35,63,.16)]"><GraduationCap className="h-5 w-5" /></div>
          {!collapsed && <div className="min-w-0"><p className="truncate text-[15px] font-bold tracking-tight">Colégio Gestão</p><p className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-[.18em] text-[#8c98a5]">Painel administrativo</p></div>}
          {!isMobile && <button className="ml-auto rounded-lg p-1.5 text-[#9aa5ae] transition hover:bg-[#f1f4f3] hover:text-[#12233f]" onClick={() => setCollapsed(!collapsed)} aria-label="Recolher menu">{collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}</button>}
        </div>
        <nav className="flex-1 space-y-1.5 px-3 py-6">
          <p className={cn("mb-3 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-[#9aa5ae]", collapsed && "text-center px-0")}>{collapsed ? "•" : "Menu principal"}</p>
          {menuItems.map(item => {
            const active = activeItem.path === item.path;
            return <button key={item.path} onClick={() => navigate(item.path)} className={cn("group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-semibold transition", active ? "bg-[#e8f3f1] text-[#147a73]" : "text-[#71808e] hover:bg-[#f5f7f6] hover:text-[#12233f]", collapsed && "justify-center px-0")}>
              <item.icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-[#14877e]" : "text-[#91a0aa] group-hover:text-[#506273]")} />
              {!collapsed && <><span className="flex-1">{item.label}</span>{active && <ChevronRight className="h-3.5 w-3.5" />}</>}
            </button>;
          })}
          {!collapsed && <div className="mt-9 rounded-2xl bg-[#12233f] p-4 text-white"><div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-white/10"><ShieldCheck className="h-4 w-4 text-[#8be0cf]" /></div><p className="text-xs font-bold">Tudo em um só lugar</p><p className="mt-1 text-[11px] leading-4 text-white/60">Acompanhe a rotina do colégio com clareza.</p></div>}
        </nav>
        <div className="border-t border-[#edf0ef] p-3">
          <div className={cn("flex items-center gap-3 rounded-xl px-2 py-2", collapsed && "justify-center px-0")}>
            <Avatar className="h-9 w-9 border border-[#dbe4e4] bg-[#e8f3f1]"><AvatarFallback className="bg-[#e8f3f1] text-xs font-bold text-[#147a73]">{user?.name?.slice(0, 1).toUpperCase() ?? "A"}</AvatarFallback></Avatar>
            {!collapsed && <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-[#304359]">{user?.name ?? "Administrador"}</p><p className="truncate text-[10px] text-[#97a2ad]">{user?.email ?? "Acesso interno"}</p></div>}
            {!collapsed && (user ? <button onClick={logout} className="rounded-lg p-1.5 text-[#a5afb7] hover:bg-[#f1f4f3] hover:text-[#12233f]" aria-label="Sair"><LogOut className="h-4 w-4" /></button> : <button onClick={() => startLogin()} className="rounded-lg p-1.5 text-[#14877e] hover:bg-[#e8f3f1]" aria-label="Entrar"><LogIn className="h-4 w-4" /></button>)}
          </div>
        </div>
        {!collapsed && !isMobile && <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-[#8be0cf]" onMouseDown={() => setResizing(true)} />}
      </aside>
      <main className={cn("min-w-0 flex-1 transition-[margin] duration-200", isMobile ? "ml-0" : collapsed ? "ml-[76px]" : "ml-[var(--school-sidebar-width)]")} style={{ "--school-sidebar-width": `${sidebarWidth}px` } as React.CSSProperties}>
        <header className="sticky top-0 z-30 flex h-[70px] items-center justify-between border-b border-[#e8eceb] bg-[#f7f7f3]/90 px-5 backdrop-blur-md sm:px-8">
          <div className="flex items-center gap-3"><button className="rounded-lg p-2 text-[#71808e] hover:bg-white" onClick={() => isMobile ? setMobileOpen(true) : setCollapsed(!collapsed)} aria-label="Abrir menu">{isMobile ? <Menu className="h-5 w-5" /> : <PanelLeftOpen className="h-4 w-4" />}</button><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#a1abb3]">Colégio Horizonte</p><h1 className="text-sm font-bold text-[#12233f] sm:text-base">{activeItem.label}</h1></div></div>
          <div className="flex items-center gap-3"><div className="hidden items-center gap-2 rounded-full bg-white px-3 py-2 text-[11px] font-semibold text-[#748290] shadow-sm sm:flex"><span className="h-2 w-2 rounded-full bg-[#38b79e]" /> Ano letivo 2026</div><div className="h-8 w-px bg-[#e1e6e5]" /><div className="grid h-9 w-9 place-items-center rounded-full bg-[#f0ded5] text-xs font-bold text-[#a95137]">{user?.name?.slice(0, 1).toUpperCase() ?? "A"}</div></div>
        </header>
        <div className="px-5 py-6 sm:px-8 sm:py-8">{children}</div>
      </main>
    </div>
  );
}
