import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Inbox, MessageCircle, Send, ShieldCheck, UserPlus, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const fieldClass = "h-11 w-full rounded-xl border border-[#cfddd6] bg-[#fbfcf9] px-3.5 text-sm text-[#3b4d60] outline-none transition placeholder:text-[#789089] focus:border-[#76c9bc] focus:ring-2 focus:ring-[#ccebe5]";
const emptyAccess = { studentId: "", email: "", fullName: "", phone: "", password: "" };

type ChatMessage = {
  id: number;
  guardianId: number;
  guardianName: string | null;
  email: string | null;
  studentId: number | null;
  studentName: string | null;
  senderName: string | null;
  direction: "fromGuardian" | "fromSchool";
  subject: string;
  body: string;
  createdAt: Date | string;
  readAt: Date | string | null;
};

type ChatThread = {
  key: string;
  guardianId: number;
  guardianName: string;
  email: string;
  studentId: number | null;
  studentName: string;
  subject: string;
  secretaryNames: string[];
  messages: ChatMessage[];
  lastMessage: ChatMessage;
};

function threadKey(message: Pick<ChatMessage, "guardianId" | "studentId" | "subject">) {
  return `${message.guardianId}:${message.studentId ?? "all"}:${message.subject.trim().toLowerCase()}`;
}

export default function FamilyCommunication() {
  const me = trpc.auth.me.useQuery();
  const allowed = me.data?.localRole === "owner" || me.data?.localPermissions?.includes("communications");
  const utils = trpc.useUtils();
  const students = trpc.school.students.useQuery(undefined, { enabled: Boolean(allowed) });
  const accounts = trpc.school.guardianAccounts.useQuery(undefined, { enabled: Boolean(allowed) });
  const messages = trpc.school.schoolMessages.useQuery(undefined, { enabled: Boolean(allowed), refetchInterval: 3000 });
  const [access, setAccess] = useState(emptyAccess);
  const [resetTarget, setResetTarget] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [accountSearch, setAccountSearch] = useState("");
  const [editTarget, setEditTarget] = useState<number | null>(null);
  const [editValues, setEditValues] = useState({ email: "", fullName: "", phone: "", newPassword: "" });
  const [chat, setChat] = useState({ guardianId: "", studentId: "", subject: "", body: "" });
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const createAccess = trpc.school.createGuardianAccount.useMutation({
    onSuccess: async result => {
      setAccess(emptyAccess);
      await utils.school.guardianAccounts.invalidate();
      toast.success(`Acesso criado para ${result.studentName}.`);
    },
    onError: error => toast.error(error.message),
  });
  const resetAccessPassword = trpc.school.resetGuardianPassword.useMutation({
    onSuccess: async result => {
      setResetTarget(null);
      setResetPassword("");
      await utils.school.guardianAccounts.invalidate();
      toast.success(`Senha de ${result.fullName} redefinida.`);
    },
    onError: error => toast.error(error.message),
  });
  const updateAccess = trpc.school.updateGuardianAccount.useMutation({
    onSuccess: async result => {
      setEditTarget(null);
      setEditValues({ email: "", fullName: "", phone: "", newPassword: "" });
      await utils.school.guardianAccounts.invalidate();
      toast.success(`Dados de ${result.fullName} atualizados.`);
    },
    onError: error => toast.error(error.message),
  });
  const send = trpc.school.sendGuardianAnnouncement.useMutation({
    onSuccess: async () => {
      setChat(current => ({ ...current, body: "" }));
      await utils.school.schoolMessages.invalidate();
      toast.success("Resposta enviada no chat.");
    },
    onError: error => toast.error(error.message),
  });
  const threads = useMemo<ChatThread[]>(() => {
    const map = new Map<string, ChatThread>();
    for (const item of (messages.data ?? []) as ChatMessage[]) {
      const key = threadKey(item);
      const existing = map.get(key);
      if (existing) {
        existing.messages.push(item);
        if (item.direction === "fromSchool" && item.senderName && !existing.secretaryNames.includes(item.senderName)) existing.secretaryNames.push(item.senderName);
        if (new Date(item.createdAt).getTime() > new Date(existing.lastMessage.createdAt).getTime()) existing.lastMessage = item;
      } else {
        map.set(key, {
          key,
          guardianId: item.guardianId,
          guardianName: item.guardianName ?? "Responsável",
          email: item.email ?? "",
          studentId: item.studentId,
          studentName: item.studentName ?? "Todos os alunos",
          subject: item.subject,
          secretaryNames: item.direction === "fromSchool" && item.senderName ? [item.senderName] : [],
          messages: [item],
          lastMessage: item,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime());
  }, [messages.data]);
  const activeThread = threads.find(thread => thread.key === selectedThread) ?? threads[0] ?? null;
  const filteredAccounts = useMemo(() => {
    const query = accountSearch.trim().toLocaleLowerCase("pt-BR");
    if (!query) return accounts.data ?? [];
    return (accounts.data ?? []).filter(account => [account.fullName, account.email, account.phone ?? "", account.studentName ?? ""].some(value => value.toLocaleLowerCase("pt-BR").includes(query)));
  }, [accounts.data, accountSearch]);
  useEffect(() => {
    if (activeThread && !selectedThread) setSelectedThread(activeThread.key);
  }, [activeThread, selectedThread]);
  useEffect(() => {
    if (activeThread) setChat(current => ({ ...current, guardianId: String(activeThread.guardianId), studentId: activeThread.studentId ? String(activeThread.studentId) : "", subject: activeThread.subject }));
  }, [activeThread?.key]);
  if (!allowed) return <Card><CardContent className="p-8 text-sm text-[#516273]">Sua função não tem permissão para acessar a comunicação com famílias.</CardContent></Card>;
  return <div className="mx-auto max-w-7xl space-y-7">
    <section className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#138378]">Comunicação escolar</p><h2 className="mt-2 font-display text-3xl font-bold text-[#12233f]">Chat com as famílias</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#758492]">Responda às conversas iniciadas pelos responsáveis. As mensagens são atualizadas automaticamente a cada poucos segundos.</p></div><Badge className="w-fit bg-[#e5f3ef] px-3 py-1.5 text-[#10766c] hover:bg-[#e5f3ef]"><ShieldCheck className="mr-1.5 h-4 w-4" /> Chat protegido</Badge></section>
    <Card className="border-[#e6eae9] bg-white shadow-[0_12px_32px_rgba(26,54,73,.055)]"><CardContent className="p-0"><div className="flex items-center justify-between border-b border-[#edf1ef] px-5 py-4 sm:px-7"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#edf1f9] text-[#5470aa]"><Inbox className="h-5 w-5" /></div><div><h3 className="font-bold text-[#12233f]">Conversas</h3><p className="text-xs text-[#647b79]">{threads.length} conversa(s) ativa(s)</p></div></div><Badge variant="outline" className="border-[#ccece1] bg-[#eff9f4] text-[#158265]">Atualização automática</Badge></div><div className="grid min-h-[520px] md:grid-cols-[minmax(230px,.42fr)_minmax(0,1fr)]"><div className="border-b border-[#edf1ef] md:border-b-0 md:border-r">{messages.isLoading ? <p className="p-5 text-sm text-[#647b79]">Carregando chats...</p> : threads.map(thread => <button type="button" key={thread.key} onClick={() => setSelectedThread(thread.key)} className={`w-full border-b border-[#f0f3f1] px-5 py-4 text-left transition hover:bg-[#f6faf7] ${activeThread?.key === thread.key ? "bg-[#eef8f3]" : "bg-white"}`}><div className="flex items-start justify-between gap-2"><p className="truncate text-sm font-bold text-[#173841]">Responsável: {thread.guardianName}</p><span className="shrink-0 text-[10px] text-[#8b9d97]">{new Date(thread.lastMessage.createdAt).toLocaleDateString("pt-BR")}</span></div><p className="mt-1 truncate text-xs text-[#6d817e]">Aluno: {thread.studentName} · {thread.subject}</p><p className="mt-2 truncate text-xs text-[#81948f]">{thread.lastMessage.body}</p></button>)}{!messages.isLoading && !threads.length && <div className="p-6 text-center"><MessageCircle className="mx-auto h-8 w-8 text-[#73a897]" /><p className="mt-3 text-sm font-bold text-[#33564d]">Nenhum chat iniciado</p><p className="mt-1 text-xs leading-5 text-[#647b79]">O responsável precisa enviar a primeira mensagem pelo portal da família.</p></div>}</div><div className="flex min-h-[520px] flex-col bg-[#fbfdfb]">{activeThread ? <><div className="border-b border-[#e7eeea] bg-white px-5 py-4 sm:px-7"><p className="font-bold text-[#12233f]">Responsável: {activeThread.guardianName}</p><p className="mt-1 text-xs text-[#647b79]">E-mail: {activeThread.email || "não informado"}</p><p className="mt-1 text-xs text-[#647b79]">Aluno: {activeThread.studentName}</p><p className="mt-1 text-xs font-semibold text-[#14877e]">Assunto: {activeThread.subject}</p><p className="mt-2 text-xs font-semibold text-[#5470aa]">Secretaria: {activeThread.secretaryNames.length ? activeThread.secretaryNames.join(", ") : "aguardando resposta da secretaria"}</p></div><div className="flex-1 space-y-3 overflow-y-auto p-5 sm:p-7">{[...activeThread.messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).map(item => <div key={item.id} className={`flex ${item.direction === "fromSchool" ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${item.direction === "fromSchool" ? "rounded-br-md bg-[#dff4ea] text-[#214c45]" : "rounded-bl-md bg-white text-[#526374]"}`}><p className="mb-2 text-[11px] font-bold uppercase tracking-[.08em] opacity-70">{item.direction === "fromSchool" ? `Secretaria: ${item.senderName ?? "Secretaria"}` : `Responsável: ${activeThread.guardianName}`}</p><p className="whitespace-pre-wrap leading-6">{item.body}</p><p className="mt-2 text-[10px] opacity-60">{new Date(item.createdAt).toLocaleString("pt-BR")}</p></div></div>)}</div><form className="border-t border-[#e7eeea] bg-white p-4 sm:p-5" onSubmit={event => { event.preventDefault(); if (!chat.body.trim()) return; send.mutate({ guardianId: activeThread.guardianId, studentId: activeThread.studentId ?? undefined, subject: activeThread.subject, body: chat.body }); }}><div className="mb-2 text-[11px] font-semibold text-[#647b79]">Respondendo como: <span className="text-[#14877e]">{me.data?.name ?? "Secretaria"}</span></div><div className="flex gap-2"><Input aria-label="Digite uma resposta" placeholder="Digite uma resposta..." value={chat.body} onChange={event => setChat(current => ({ ...current, body: event.target.value }))} maxLength={5000} /><Button disabled={send.isPending || !chat.body.trim()} className="shrink-0 bg-[#14877e] text-white hover:bg-[#0f6e65]" aria-label="Enviar resposta"><Send className="h-4 w-4" /></Button></div></form></> : <div className="grid flex-1 place-items-center p-7 text-center"><MessageCircle className="mx-auto h-9 w-9 text-[#73a897]" /><p className="mt-3 text-sm font-bold text-[#33564d]">Selecione uma conversa</p><p className="mt-1 text-xs text-[#647b79]">Os dados do responsável e da secretaria aparecem no cabeçalho e nas mensagens.</p></div>}</div></div></CardContent></Card>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,.7fr)]">
      <Card className="border-[#e6eae9] bg-white shadow-[0_12px_32px_rgba(26,54,73,.055)]"><CardContent className="p-5 sm:p-7"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#e7f4f1] text-[#14877e]"><UserPlus className="h-5 w-5" /></div><div><h3 className="font-bold text-[#12233f]">Criar acesso familiar</h3><p className="text-xs text-[#647b79]">Cadastre o login do responsável para o portal da família.</p></div></div><form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={event => { event.preventDefault(); createAccess.mutate({ studentId: Number(access.studentId), email: access.email, fullName: access.fullName, phone: access.phone, password: access.password }); }}>
        <label className="space-y-1.5 sm:col-span-2"><Label htmlFor="guardian-student">Aluno vinculado</Label><select id="guardian-student" required className={fieldClass} value={access.studentId} onChange={event => setAccess(current => ({ ...current, studentId: event.target.value }))}><option value="">Selecione um aluno ativo</option>{(students.data ?? []).map(student => <option key={student.id} value={student.id}>{student.name} — {student.guardianName ?? "responsável não informado"}</option>)}</select></label>
        <label className="space-y-1.5"><Label htmlFor="guardian-name">Nome do responsável</Label><Input id="guardian-name" required minLength={2} maxLength={160} placeholder="Nome completo" value={access.fullName} onChange={event => setAccess(current => ({ ...current, fullName: event.target.value }))} /></label>
        <label className="space-y-1.5"><Label htmlFor="guardian-email">E-mail do responsável</Label><Input id="guardian-email" type="email" required maxLength={320} placeholder="responsavel@email.com" value={access.email} onChange={event => setAccess(current => ({ ...current, email: event.target.value }))} /></label>
        <label className="space-y-1.5"><Label htmlFor="guardian-phone">Telefone</Label><Input id="guardian-phone" type="tel" maxLength={20} placeholder="(00) 00000-0000" value={access.phone} onChange={event => setAccess(current => ({ ...current, phone: event.target.value }))} /></label>
        <label className="space-y-1.5 sm:col-span-2"><Label htmlFor="guardian-password">Senha inicial</Label><Input id="guardian-password" type="password" required minLength={8} maxLength={128} placeholder="Mínimo de 8 caracteres" value={access.password} onChange={event => setAccess(current => ({ ...current, password: event.target.value }))} /><span className="text-[11px] text-[#788d88]">Use o mesmo e-mail cadastrado no responsável do aluno.</span></label>
        <Button disabled={createAccess.isPending || !access.studentId} className="bg-[#14877e] text-white hover:bg-[#0f6e65] sm:col-span-2"><UserPlus className="mr-2 h-4 w-4" />{createAccess.isPending ? "Criando acesso..." : "Criar acesso familiar"}</Button>
      </form></CardContent></Card>
      <Card className="border-[#e6eae9] bg-white shadow-[0_12px_32px_rgba(26,54,73,.055)]"><CardContent className="p-5 sm:p-7"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#edf1f9] text-[#5470aa]"><UsersRound className="h-5 w-5" /></div><div><h3 className="font-bold text-[#12233f]">Acessos cadastrados</h3><p className="text-xs text-[#647b79]">Contas disponíveis no portal familiar.</p></div></div><div className="mt-5 space-y-3"><Input aria-label="Pesquisar acesso familiar" placeholder="Pesquisar por nome, e-mail, telefone ou aluno..." value={accountSearch} onChange={event => setAccountSearch(event.target.value)} /><div className="space-y-2">{filteredAccounts.map(account => <div key={`${account.id}-${account.studentId ?? "all"}`} className="rounded-xl border border-[#e8edeb] p-3"><div className="flex items-start justify-between gap-2"><div><p className="text-sm font-semibold text-[#12233f]">{account.fullName}</p><p className="mt-1 text-xs text-[#647b79]">{account.email}</p><p className="mt-1 text-[11px] text-[#81948f]">{account.studentName ?? "Aluno não vinculado"}</p><p className="mt-1 text-[11px] text-[#81948f]">Telefone: {account.phone || "não informado"}</p></div><div className="flex shrink-0 gap-1.5"><Button type="button" variant="outline" className="h-8 shrink-0 px-2 text-[11px] text-[#5470aa]" onClick={() => { setResetTarget(resetTarget === account.id ? null : account.id); setResetPassword(""); }}>{resetTarget === account.id ? "Cancelar" : "Redefinir senha"}</Button><Button type="button" variant="outline" className="h-8 px-2 text-[11px] text-[#14877e]" onClick={() => { setEditTarget(editTarget === account.id ? null : account.id); setEditValues({ email: account.email, fullName: account.fullName, phone: account.phone ?? "", newPassword: "" }); }}>Editar dados</Button></div></div>{resetTarget === account.id && <form className="mt-3 flex gap-2" onSubmit={event => { event.preventDefault(); resetAccessPassword.mutate({ guardianId: account.id, newPassword: resetPassword }); }}><Input type="password" required minLength={8} maxLength={128} aria-label={`Nova senha de ${account.fullName}`} placeholder="Nova senha (mín. 8)" value={resetPassword} onChange={event => setResetPassword(event.target.value)} /><Button type="submit" disabled={resetAccessPassword.isPending || resetPassword.length < 8} className="shrink-0 bg-[#5470aa] text-white hover:bg-[#405b91]">{resetAccessPassword.isPending ? "Salvando..." : "Salvar"}</Button></form>}{editTarget === account.id && <form className="mt-3 grid gap-2 rounded-lg bg-[#f7faf8] p-3" onSubmit={event => { event.preventDefault(); updateAccess.mutate({ guardianId: account.id, ...editValues, newPassword: editValues.newPassword.trim() || undefined }); }}><Input required type="text" maxLength={160} aria-label={`Nome de ${account.fullName}`} placeholder="Nome completo" value={editValues.fullName} onChange={event => setEditValues(current => ({ ...current, fullName: event.target.value }))} /><Input required type="email" maxLength={320} aria-label={`E-mail de ${account.fullName}`} placeholder="E-mail" value={editValues.email} onChange={event => setEditValues(current => ({ ...current, email: event.target.value }))} /><Input type="tel" maxLength={20} aria-label={`Telefone de ${account.fullName}`} placeholder="Telefone" value={editValues.phone} onChange={event => setEditValues(current => ({ ...current, phone: event.target.value }))} /><Input type="password" minLength={8} maxLength={128} aria-label={`Nova senha opcional de ${account.fullName}`} placeholder="Nova senha (opcional, mín. 8)" value={editValues.newPassword} onChange={event => setEditValues(current => ({ ...current, newPassword: event.target.value }))} /><div className="flex justify-end gap-2"><Button type="button" variant="ghost" className="h-8" onClick={() => setEditTarget(null)}>Cancelar</Button><Button type="submit" disabled={updateAccess.isPending || editValues.newPassword.length > 0 && editValues.newPassword.length < 8} className="h-8 bg-[#14877e] text-white hover:bg-[#0f6e65]">{updateAccess.isPending ? "Salvando..." : "Salvar dados"}</Button></div></form>}</div>)}{!accounts.isLoading && !(accounts.data ?? []).length && <p className="text-xs text-[#647b79]">Nenhum acesso familiar cadastrado.</p>}</div></div></CardContent></Card>
    </div>
    <Card className="border-[#e6eae9] bg-white shadow-[0_12px_32px_rgba(26,54,73,.055)]"><CardContent className="p-5 sm:p-7"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#e7f4f1] text-[#14877e]"><MessageCircle className="h-5 w-5" /></div><div><h3 className="font-bold text-[#12233f]">Como o chat funciona</h3><p className="text-xs text-[#647b79]">O responsável inicia a conversa no portal; a secretaria responde pelo chat. O histórico identifica os dois lados.</p></div></div></CardContent></Card>
  </div>;
}
