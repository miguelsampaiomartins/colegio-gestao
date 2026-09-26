import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Archive, ArrowUpRight, CalendarDays, ChevronRight, ClipboardList, DatabaseBackup, GraduationCap, KeyRound, LayoutDashboard, LogIn, LogOut, Menu, PanelLeftClose, PanelLeftOpen, ShieldCheck, ShoppingCart, Sparkles, UsersRound, X } from "lucide-react";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

const menuItems = [
  { icon: LayoutDashboard, label: "Visão geral", path: "/" },
  { icon: UsersRound, label: "Alunos e matrículas", path: "/alunos" },
  { icon: Archive, label: "Estoque", path: "/estoque" },
  { icon: ShoppingCart, label: "Vendas", path: "/vendas" },
  { icon: ClipboardList, label: "Anotações", path: "/anotacoes" },
];
const SIDEBAR_WIDTH_KEY = "school-sidebar-width";
const year = new Date().getFullYear();

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
    return Number.isFinite(saved) && saved >= 220 && saved <= 340 ? saved : 268;
  });
  const { loading, user } = useAuth();
  const provider = trpc.auth.provider.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const login = trpc.auth.login.useMutation({ onSuccess: async () => { setPassword(""); await utils.auth.me.invalidate(); } });
  useEffect(() => localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString()), [sidebarWidth]);
  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    const google = provider.data?.mode === "google";
    const local = provider.data?.mode === "password";
    const error = new URLSearchParams(window.location.search).get("login_error");
    return <div className="school-login grid min-h-screen bg-[#f4f7f3] lg:grid-cols-[minmax(360px,44%)_1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#102b34] p-10 text-white lg:flex xl:p-14">
        <div className="pointer-events-none absolute -right-48 -top-32 h-[560px] w-[560px] rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -right-28 -top-10 h-[440px] w-[440px] rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -right-6 top-20 h-[320px] w-[320px] rounded-full bg-[#4d9b77]/20 blur-3xl" />
        <div className="relative flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#bfe7d1] text-[#102b34]"><GraduationCap className="h-6 w-6" /></span><div><p className="font-display text-xl font-bold tracking-tight">Colégio Gestão</p><p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[#b8d5cb]">Sua escola, organizada.</p></div></div>
        <div className="relative max-w-lg pb-9"><span className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-medium text-[#c9e4d9]"><Sparkles className="h-4 w-4" /> Gestão escolar sem complicação</span><h2 className="font-display text-5xl font-semibold leading-[1.1] tracking-tight xl:text-[4rem]">Um espaço para cuidar de <span className="text-[#bfe7d1]">cada detalhe.</span></h2><p className="mt-6 max-w-md text-base leading-7 text-[#c3d5d2]">Alunos, matrículas, estoque, vendas e anotações em uma rotina mais clara para toda a equipe.</p><div className="mt-10 h-px w-24 bg-[#bfe7d1]/55" /></div>
        <p className="relative text-xs text-[#a7c3bd]">Painel administrativo · Acesso reservado à equipe autorizada</p>
      </div>
      <div className="flex min-h-screen flex-col">
        <div className="flex items-center gap-2 p-6 text-[#173841] lg:hidden"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#153b42] text-white"><GraduationCap className="h-5 w-5" /></span><span className="font-display text-lg font-semibold">Colégio Gestão</span></div>
        <div className="flex flex-1 items-center justify-center px-5 pb-16 pt-6 sm:px-10 lg:px-12"><div className="w-full max-w-[420px] rounded-[28px] border border-[#e5eee8] bg-white p-7 shadow-[0_24px_72px_rgba(28,58,53,.07)] sm:p-10 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none"><span className="inline-flex rounded-full bg-[#e7f4ec] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.16em] text-[#167267]">Bem-vindo de volta</span><h1 className="mt-5 font-display text-4xl font-semibold leading-tight tracking-tight text-[#18333b]">Acesse o painel da escola</h1><p className="mt-3 text-sm leading-6 text-[#5b7375]">Entre com sua conta autorizada para continuar a rotina do colégio.</p>
          {local ? <form className="mt-8 space-y-5 text-left" onSubmit={event => { event.preventDefault(); login.mutate({ username, password }); }}>
            <div className="space-y-2"><Label htmlFor="school-login" className="text-[13px] font-semibold text-[#284e53]">Nome de usuário</Label><Input id="school-login" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={64} placeholder="ex.: amanda1234" className="h-12 rounded-xl border-[#d5e2db] bg-[#f9fbf9] px-4 text-sm" value={username} onChange={event => setUsername(event.target.value.toLowerCase())} /></div>
            <div className="space-y-2"><Label htmlFor="school-password" className="text-[13px] font-semibold text-[#284e53]">Senha</Label><Input id="school-password" type="password" autoComplete="current-password" required className="h-12 rounded-xl border-[#d5e2db] bg-[#f9fbf9] px-4 text-sm" value={password} onChange={event => setPassword(event.target.value)} /></div>
            <Button disabled={!provider.data?.configured || login.isPending} className="h-12 w-full rounded-xl bg-[#147a6e] text-sm font-bold text-white shadow-[0_10px_22px_rgba(20,122,110,.19)] hover:bg-[#0f655d] disabled:opacity-50">{login.isPending ? "Entrando..." : "Entrar no sistema"}<ArrowUpRight className="ml-2 h-4 w-4" /></Button>
            {login.error && <p role="alert" className="text-center text-sm font-semibold text-[#ac4c3d]">{login.error.message}</p>}
            <p className="text-center text-xs leading-5 text-[#647a7d]">Esqueceu a senha? Peça ao dono do colégio para redefini-la.</p>
          </form> : <Button disabled={provider.isLoading || provider.isError || !provider.data?.configured} onClick={() => google ? window.location.assign("/api/auth/google/start") : startLogin()} className="mt-8 h-12 w-full rounded-xl bg-[#147a6e] text-sm font-bold text-white hover:bg-[#0f655d] disabled:opacity-50">{google ? "Entrar com Google" : "Entrar no sistema"}<LogIn className="ml-2 h-4 w-4" /></Button>}
          {error && <p role="alert" className="mt-5 text-sm font-semibold text-[#ac4c3d]">{error === "cancelled" ? "O login foi cancelado. Tente novamente." : "Não foi possível concluir o login. Confira as credenciais e tente novamente."}</p>}
          {provider.data && !provider.data.configured && <p role="alert" className="mt-5 rounded-xl bg-[#fff2eb] p-3 text-sm leading-5 text-[#a84434]">{google ? `Configure o Google no .env e reinicie o servidor: ${provider.data.missing.join(", ")}.` : local ? `Configure o banco e a chave de sessão: ${provider.data.missing.join(", ")}.` : "Configure o provedor de login antes de entrar."}</p>}
          {provider.isError && <p role="alert" className="mt-5 text-sm text-[#ac4c3d]">Não foi possível consultar a configuração de login. Verifique o servidor.</p>}
        </div></div>
        <p className="px-5 pb-7 text-center text-[11px] font-medium text-[#81948f]">Ambiente de trabalho reservado · Colégio Gestão</p>
      </div>
    </div>;
  }
  return <div className="school-surface min-h-screen text-[#172b38]"><DashboardLayoutContent collapsed={collapsed} setCollapsed={setCollapsed} sidebarWidth={sidebarWidth} setSidebarWidth={setSidebarWidth}>{children}</DashboardLayoutContent></div>;
}

function DashboardLayoutContent({ children, collapsed, setCollapsed, sidebarWidth, setSidebarWidth }: { children: React.ReactNode; collapsed: boolean; setCollapsed: (value: boolean) => void; sidebarWidth: number; setSidebarWidth: (value: number) => void }) {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [resizing, setResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const adminMenu = user?.localRole === "owner" ? [{ icon: ShieldCheck, label: "Equipe e acessos", path: "/equipe" }, { icon: DatabaseBackup, label: "Auditoria e backups", path: "/auditoria" }] : [];
  const accountMenu = user?.localRole ? [{ icon: KeyRound, label: "Minha conta", path: "/minha-conta" }] : [];
  const activeItem = [...menuItems, ...adminMenu, ...accountMenu].find(item => item.path === location) ?? menuItems[0];

  useEffect(() => {
    const move = (event: MouseEvent) => { if (resizing && !collapsed) { const left = sidebarRef.current?.getBoundingClientRect().left ?? 0; setSidebarWidth(Math.min(340, Math.max(220, event.clientX - left))); } };
    const up = () => setResizing(false);
    if (resizing) { document.addEventListener("mousemove", move); document.addEventListener("mouseup", up); document.body.style.cursor = "col-resize"; document.body.style.userSelect = "none"; }
    return () => { document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up); document.body.style.cursor = ""; document.body.style.userSelect = ""; };
  }, [collapsed, resizing, setSidebarWidth]);

  const navigate = (path: string) => { setLocation(path); setMobileOpen(false); };
  const renderMenu = (items: typeof menuItems) => items.map(item => { const active = activeItem.path === item.path; return <button type="button" key={item.path} onClick={() => navigate(item.path)} title={collapsed && !isMobile ? item.label : undefined} aria-current={active ? "page" : undefined} className={cn("group relative flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold", active ? "bg-[#bce9d6] text-[#103932] shadow-[0_6px_18px_rgba(3,22,19,.1)]" : "text-[#bfd3cc] hover:bg-white/10 hover:text-white", collapsed && !isMobile && "justify-center px-0")}><item.icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-[#0a695e]" : "text-[#a6c5ba] group-hover:text-white")} />{(!collapsed || isMobile) && <><span className="flex-1">{item.label}</span>{active && <ChevronRight className="h-4 w-4" />}</>}</button>; });

  return <div className="flex min-h-screen">
    {isMobile && mobileOpen && <button aria-label="Fechar menu" className="fixed inset-0 z-40 bg-[#102b34]/60 backdrop-blur-[2px]" onClick={() => setMobileOpen(false)} />}
    <aside ref={sidebarRef} style={{ width: isMobile ? 280 : collapsed ? 78 : sidebarWidth }} className={cn("school-sidebar fixed inset-y-0 left-0 z-50 flex flex-col overflow-hidden border-r border-[#315154] text-white shadow-[10px_0_36px_rgba(6,34,38,.08)]", isMobile && !mobileOpen && "-translate-x-full", isMobile && mobileOpen && "translate-x-0")}>
      <div className="flex h-[84px] items-center gap-3 border-b border-white/10 px-5"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#bce9d6] text-[#11383c]"><GraduationCap className="h-6 w-6" /></span>{(!collapsed || isMobile) && <div className="min-w-0"><p className="truncate font-display text-base font-semibold tracking-tight">Colégio Gestão</p><p className="truncate text-[10px] font-semibold uppercase tracking-[.16em] text-[#a7c6ba]">Gestão escolar</p></div>}{isMobile && <button type="button" aria-label="Fechar menu" onClick={() => setMobileOpen(false)} className="ml-auto rounded-lg p-2 text-[#b8d2c8] hover:bg-white/10"><X className="h-5 w-5" /></button>}{!isMobile && <button type="button" className="ml-auto rounded-lg p-2 text-[#a8c4ba] hover:bg-white/10 hover:text-white" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expandir menu" : "Recolher menu"}>{collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}</button>}</div>
      <nav className="flex-1 space-y-7 overflow-y-auto px-3 py-6" aria-label="Navegação principal"><div className="space-y-1"><p className={cn("mb-3 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-[#92b2aa]", collapsed && !isMobile && "px-0 text-center")}>{collapsed && !isMobile ? "•" : "Rotina escolar"}</p>{renderMenu(menuItems)}</div>{(adminMenu.length > 0 || accountMenu.length > 0) && <div className="space-y-1 border-t border-white/10 pt-5"><p className={cn("mb-3 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-[#92b2aa]", collapsed && !isMobile && "px-0 text-center")}>{collapsed && !isMobile ? "•" : "Administração"}</p>{renderMenu([...adminMenu, ...accountMenu])}</div>}{(!collapsed || isMobile) && <div className="mx-1 mt-8 rounded-2xl border border-[#89c7ae]/25 bg-[#bce9d6]/10 p-4"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#bce9d6]/20 text-[#bce9d6]"><Sparkles className="h-4 w-4" /></span><p className="mt-3 text-xs font-bold text-white">Sua rotina em ordem</p><p className="mt-1 text-[11px] leading-5 text-[#bad0c6]">Todas as operações do colégio em um só lugar.</p></div>}</nav>
      <div className="border-t border-white/10 p-3"><div className={cn("flex items-center gap-3 rounded-xl bg-white/5 px-2 py-2.5", collapsed && !isMobile && "justify-center px-0")}><Avatar className="h-9 w-9 border border-white/10"><AvatarFallback className="bg-[#bce9d6] text-xs font-bold text-[#103932]">{user?.name?.slice(0, 1).toUpperCase() ?? "A"}</AvatarFallback></Avatar>{(!collapsed || isMobile) && <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-white">{user?.name ?? "Administrador"}</p><p className="truncate text-[11px] text-[#b2cfc3]">{user?.localRole === "owner" ? "Dono do colégio" : user?.localRole === "staff" ? "Funcionário" : user?.email ?? "Acesso interno"}</p></div>}{(!collapsed || isMobile) && <button type="button" onClick={logout} className="rounded-lg p-2 text-[#b2cfc3] hover:bg-white/10 hover:text-white" aria-label="Sair"><LogOut className="h-4 w-4" /></button>}</div></div>
      {!collapsed && !isMobile && <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-[#bce9d6]/40" onMouseDown={() => setResizing(true)} />}
    </aside>
    <main className={cn("school-main min-w-0 flex-1", isMobile ? "ml-0" : collapsed ? "ml-[78px]" : "ml-[var(--school-sidebar-width)]")} style={{ "--school-sidebar-width": `${sidebarWidth}px` } as React.CSSProperties}>
      <header className="sticky top-0 z-30 flex min-h-[76px] items-center justify-between gap-3 border-b border-[#e3ebe5] bg-white/90 px-5 backdrop-blur-md sm:px-8 lg:px-10"><div className="flex min-w-0 items-center gap-3"><button type="button" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#e2ebe4] text-[#345851] hover:bg-[#e9f5ee]" onClick={() => isMobile ? setMobileOpen(true) : setCollapsed(!collapsed)} aria-label={isMobile ? "Abrir menu" : collapsed ? "Expandir menu" : "Recolher menu"} aria-expanded={isMobile ? mobileOpen : !collapsed}>{isMobile ? <Menu className="h-5 w-5" /> : <PanelLeftOpen className="h-4 w-4" />}</button><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#568277]">Painel administrativo</p><h1 className="truncate font-display text-base font-semibold text-[#19383d] sm:text-lg">{activeItem.label}</h1></div></div><div className="flex items-center gap-3"><div className="hidden items-center gap-2 rounded-full border border-[#e4eee6] bg-[#f3f8f4] px-3 py-2 text-xs font-semibold text-[#38645a] sm:flex"><CalendarDays className="h-3.5 w-3.5" /> Ano letivo {year}</div><div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#deede2] text-xs font-bold text-[#1e6257]">{user?.name?.slice(0, 1).toUpperCase() ?? "A"}</div></div></header>
      <div className="px-4 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-9">{children}</div>
    </main>
  </div>;
}
