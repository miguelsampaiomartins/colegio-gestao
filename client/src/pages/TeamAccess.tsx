import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, KeyRound, LockKeyhole, Plus, ShieldCheck, UserRoundCheck, UserRoundX, UsersRound } from "lucide-react";
import { useState } from "react";

const initial = { fullName: "", cpfFirstFour: "", jobTitle: "", password: "" };
function errorMessage(error: unknown) { return error instanceof Error ? error.message : "Não foi possível concluir a operação."; }

export default function TeamAccess() {
  const { user } = useAuth();
  const [form, setForm] = useState(initial);
  const [showPassword, setShowPassword] = useState(false);
  const [toggleTarget, setToggleTarget] = useState<{ id: number; name: string; active: boolean } | null>(null);
  const [resetTarget, setResetTarget] = useState<{ id: number; name: string } | null>(null);
  const [ownerPassword, setOwnerPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const utils = trpc.useUtils();
  const owner = user?.localRole === "owner";
  const team = trpc.staff.list.useQuery(undefined, { enabled: owner, retry: false });
  const create = trpc.staff.create.useMutation({ onSuccess: async username => {
    setForm(initial); await utils.staff.list.invalidate(); toast.success(`Funcionário cadastrado: ${username}`);
  }, onError: error => toast.error(error.message) });
  const setActive = trpc.staff.setActive.useMutation({ onSuccess: async () => {
    setToggleTarget(null); await utils.staff.list.invalidate(); toast.success("Acesso atualizado. Sessões anteriores foram encerradas.");
  }, onError: error => toast.error(error.message) });
  const reset = trpc.staff.resetPassword.useMutation({ onSuccess: () => {
    setResetTarget(null); setOwnerPassword(""); setNewPassword(""); toast.success("Senha alterada. O funcionário precisará entrar novamente.");
  }, onError: error => toast.error(error.message) });
  const firstName = form.fullName.trim().split(/\s+/)[0] ?? "";
  const preview = firstName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "") + form.cpfFirstFour;

  if (!owner) return <Card><CardContent className="p-8 text-sm text-[#516273]">Esta área é exclusiva do dono do colégio.</CardContent></Card>;
  return <div className="mx-auto max-w-6xl space-y-7">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#138378]">Administração geral</p><h2 className="mt-2 font-display text-3xl font-bold text-[#12233f]">Equipe e acessos</h2><p className="mt-2 text-sm text-[#758492]">Você decide quem entra no colégio. Funcionários não visualizam este painel.</p></div>
      <Badge className="w-fit bg-[#e5f3ef] px-3 py-1.5 text-[#10766c] hover:bg-[#e5f3ef]"><ShieldCheck className="mr-1.5 h-4 w-4" /> Exclusivo do dono</Badge>
    </div>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="border-[#e6eae9] bg-white shadow-[0_12px_32px_rgba(26,54,73,.055)]"><CardContent className="p-5 sm:p-7">
        <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#e7f4f1] text-[#14877e]"><UsersRound className="h-5 w-5" /></div><div><h3 className="font-bold text-[#12233f]">Pessoas cadastradas</h3><p className="text-xs text-[#647b79]">Acesso desativado bloqueia a conta imediatamente.</p></div></div>
        {team.isLoading && <p className="mt-7 text-sm text-[#647b79]">Carregando equipe...</p>}
        {team.isError && <p role="alert" className="mt-7 text-sm text-red-700">{errorMessage(team.error)}</p>}
        {!team.isLoading && !team.data?.length && <div className="mt-7 rounded-2xl border border-dashed border-[#d2e4d8] bg-[#f7fbf8] p-7 text-center"><UsersRound className="mx-auto h-8 w-8 text-[#5eaa8d]" /><p className="mt-3 text-sm font-bold text-[#2d5349]">Sua equipe começa aqui</p><p className="mt-1 text-xs text-[#607b71]">Cadastre o primeiro funcionário usando o formulário ao lado ou abaixo.</p></div>}
        <div className="mt-5 space-y-3">{team.data?.map(person => <div key={person.id} className="rounded-2xl border border-[#e8edeb] p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#f1e7de] text-sm font-bold text-[#9f6549]">{person.fullName.charAt(0).toUpperCase()}</div><div><p className="font-semibold text-[#12233f]">{person.fullName}</p><p className="mt-0.5 text-xs text-[#647b79]">{person.jobTitle} · <span className="font-mono">{person.username}</span></p></div></div>
            <Badge variant="outline" className={person.active ? "border-[#ccece1] bg-[#eff9f4] text-[#158265]" : "border-[#e5e7e9] bg-[#f6f6f6] text-[#7b8390]"}>{person.active ? "Ativo" : "Sem acesso"}</Badge>
          </div>
          {person.role === "staff" ? <div className="mt-4 grid gap-2 border-t border-[#edf0ef] pt-4 sm:flex sm:flex-wrap"><Button variant="outline" size="sm" onClick={() => setResetTarget({ id: person.id, name: person.fullName })}><KeyRound className="mr-2 h-4 w-4" />Trocar senha</Button><Button variant="outline" size="sm" className={person.active ? "text-[#ad5b4d]" : "text-[#13766d]"} onClick={() => setToggleTarget({ id: person.id, name: person.fullName, active: Boolean(person.active) })}>{person.active ? <UserRoundX className="mr-2 h-4 w-4" /> : <UserRoundCheck className="mr-2 h-4 w-4" />}{person.active ? "Remover acesso" : "Reativar acesso"}</Button></div> : <p className="mt-3 text-xs text-[#647b79]">O dono não pode ser removido por este painel.</p>}
        </div>)}</div>
      </CardContent></Card>
      <Card className="h-fit border-[#e6eae9] bg-[#fffefb] shadow-[0_12px_32px_rgba(26,54,73,.055)]"><CardContent className="p-5 sm:p-6">
        <div className="flex items-center gap-2"><Plus className="h-5 w-5 text-[#14877e]" /><h3 className="font-bold text-[#12233f]">Adicionar funcionário</h3></div>
        <p className="mt-2 text-xs leading-5 text-[#647b79]">O login combina o primeiro nome com os quatro primeiros dígitos informados do CPF. O CPF completo nunca é solicitado.</p>
        <form className="mt-5 space-y-4" onSubmit={event => { event.preventDefault(); create.mutate({ ...form, firstName }); }}>
          <div className="space-y-1.5"><Label htmlFor="team-name">Nome completo</Label><Input id="team-name" autoComplete="name" required minLength={2} maxLength={160} placeholder="Amanda Silva" value={form.fullName} onChange={event => setForm({ ...form, fullName: event.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="team-job">Função</Label><Input id="team-job" required minLength={2} maxLength={120} placeholder="Secretaria" value={form.jobTitle} onChange={event => setForm({ ...form, jobTitle: event.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="team-digits">Quatro primeiros dígitos do CPF</Label><Input id="team-digits" required inputMode="numeric" pattern="[0-9]{4}" maxLength={4} placeholder="1234" value={form.cpfFirstFour} onChange={event => setForm({ ...form, cpfFirstFour: event.target.value.replace(/\D/g, "").slice(0, 4) })} /></div>
          <div className="rounded-xl bg-[#eef5f3] px-3 py-2 text-xs text-[#486e69]">Login: <strong className="font-mono">{preview || "nome1234"}</strong></div>
          <div className="space-y-1.5"><Label htmlFor="team-password">Senha inicial</Label><div className="relative"><Input id="team-password" type={showPassword ? "text" : "password"} autoComplete="new-password" required minLength={15} maxLength={128} placeholder="Mínimo de 15 caracteres" className="pr-10" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} /><button type="button" className="absolute inset-y-0 right-2 px-2 text-[#7b8b98]" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
          <Button disabled={create.isPending} className="w-full bg-[#12233f] text-white hover:bg-[#244165]">{create.isPending ? "Salvando..." : "Criar acesso"}</Button>
        </form>
      </CardContent></Card>
    </div>
    <div className="flex items-start gap-3 rounded-xl bg-[#eef5f3] p-4 text-xs leading-5 text-[#486e69]"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" /><p>A senha protege o acesso; os quatro dígitos fazem parte do nome de usuário e não são uma senha. Para mudar sua própria senha, use <strong>Minha conta</strong> no menu.</p></div>
    <Dialog open={Boolean(toggleTarget)} onOpenChange={open => { if (!open) setToggleTarget(null); }}><DialogContent><DialogHeader><DialogTitle>{toggleTarget?.active ? "Remover acesso" : "Reativar acesso"}</DialogTitle><DialogDescription>{toggleTarget?.active ? `A conta de ${toggleTarget.name} será bloqueada e as sessões serão encerradas. O histórico de ações não será apagado.` : `A conta de ${toggleTarget?.name} voltará a poder entrar com a senha atual.`}</DialogDescription></DialogHeader><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setToggleTarget(null)}>Voltar</Button><Button disabled={setActive.isPending} className="bg-[#12233f] text-white" onClick={() => { if (toggleTarget) setActive.mutate({ id: toggleTarget.id, active: !toggleTarget.active }); }}>Confirmar</Button></div></DialogContent></Dialog>
    <Dialog open={Boolean(resetTarget)} onOpenChange={open => { if (!open) { setResetTarget(null); setOwnerPassword(""); setNewPassword(""); } }}><DialogContent><DialogHeader><DialogTitle>Trocar senha de {resetTarget?.name}</DialogTitle><DialogDescription>Confirme com sua própria senha. A sessão atual do funcionário será encerrada.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={event => { event.preventDefault(); if (resetTarget) reset.mutate({ targetId: resetTarget.id, ownerPassword, newPassword }); }}><div className="space-y-1.5"><Label htmlFor="owner-password">Sua senha de dono</Label><Input id="owner-password" type="password" autoComplete="current-password" required value={ownerPassword} onChange={event => setOwnerPassword(event.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="new-staff-password">Nova senha do funcionário</Label><Input id="new-staff-password" type="password" autoComplete="new-password" required minLength={15} maxLength={128} placeholder="Mínimo de 15 caracteres" value={newPassword} onChange={event => setNewPassword(event.target.value)} /></div><Button disabled={reset.isPending} className="w-full bg-[#12233f] text-white">{reset.isPending ? "Atualizando..." : "Salvar nova senha"}</Button></form></DialogContent></Dialog>
  </div>;
}
