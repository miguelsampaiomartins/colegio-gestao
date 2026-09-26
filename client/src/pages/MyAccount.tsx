import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function MyAccount() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const change = trpc.auth.changePassword.useMutation({
    onSuccess: async () => {
      setCurrentPassword(""); setNewPassword(""); setRepeatPassword("");
      utils.auth.me.setData(undefined, null); await utils.auth.me.invalidate();
      toast.success("Senha atualizada. Entre novamente com sua nova senha.");
    },
    onError: error => toast.error(error.message),
  });
  if (!user || !user.localRole) return <p className="text-sm text-[#71808e]">Entre com sua conta local para editar sua senha.</p>;
  return <div className="mx-auto max-w-3xl space-y-6">
    <div><p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#138378]">Sua segurança</p><h2 className="mt-2 font-display text-3xl font-bold text-[#12233f]">Minha conta</h2><p className="mt-2 text-sm text-[#758492]">Altere sua senha quando necessário. Ao salvar, todas as sessões anteriores serão encerradas.</p></div>
    <Card className="border-[#e6eae9] bg-white shadow-[0_12px_32px_rgba(26,54,73,.055)]"><CardContent className="p-6 sm:p-8"><div className="mb-6 flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-[#e8f3f1] text-[#14877e]"><KeyRound className="h-5 w-5" /></div><div><h3 className="font-bold text-[#12233f]">Senha de acesso</h3><p className="text-xs text-[#81909e]">{user.name} · {user.localRole === "owner" ? "Dono do colégio" : "Funcionário"}</p></div></div>
      <form className="max-w-md space-y-4" onSubmit={event => { event.preventDefault(); if (newPassword !== repeatPassword) { toast.error("As novas senhas não coincidem."); return; } change.mutate({ currentPassword, newPassword }); }}>
        <div className="space-y-1.5"><Label htmlFor="current">Senha atual</Label><Input id="current" type="password" autoComplete="current-password" required value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="next">Nova senha</Label><Input id="next" type="password" autoComplete="new-password" required minLength={15} maxLength={128} placeholder="Pelo menos 15 caracteres" value={newPassword} onChange={event => setNewPassword(event.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="repeat">Repita a nova senha</Label><Input id="repeat" type="password" autoComplete="new-password" required minLength={15} maxLength={128} value={repeatPassword} onChange={event => setRepeatPassword(event.target.value)} /></div>
        <Button disabled={change.isPending} className="bg-[#12233f] text-white hover:bg-[#244165]">{change.isPending ? "Alterando..." : "Salvar nova senha"}</Button>
      </form>
    </CardContent></Card>
    <div className="flex items-center gap-3 rounded-xl bg-[#eef5f3] p-4 text-xs text-[#486e69]"><ShieldCheck className="h-4 w-4 shrink-0" />Nunca compartilhe sua senha nem use os quatro dígitos do nome de usuário como senha.</div>
  </div>;
}
