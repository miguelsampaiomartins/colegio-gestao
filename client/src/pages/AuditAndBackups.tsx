import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useState } from "react";
import { ArchiveRestore, CalendarClock, CircleAlert, CircleCheck, ClipboardList, DatabaseBackup, ShieldCheck } from "lucide-react";

const dateTime = (time: number) => new Date(time).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
const entityName: Record<string, string> = { staff: "Funcionário", student: "Aluno", enrollment: "Matrícula", inventory: "Produto", sale: "Venda", incident: "Anotação" };

export default function AuditAndBackups() {
  const { user } = useAuth();
  const owner = user?.localRole === "owner";
  const [staffAccountId, setStaffAccountId] = useState<number | undefined>();
  const [beforeId, setBeforeId] = useState<number | undefined>();
  const [previous, setPrevious] = useState<Array<number | undefined>>([]);
  const people = trpc.staff.list.useQuery(undefined, { enabled: owner, retry: false });
  const logs = trpc.audit.list.useQuery({ staffAccountId, beforeId, limit: 30 }, { enabled: owner, retry: false });
  const backups = trpc.audit.backups.useQuery(undefined, { enabled: owner, retry: false });
  if (!owner) return <Card><CardContent className="p-8 text-sm text-[#516273]">Esta área é exclusiva do dono do colégio.</CardContent></Card>;

  const latest = backups.data?.[0];
  return <div className="mx-auto max-w-6xl space-y-7">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#138378]">Administração geral</p><h2 className="mt-2 font-display text-3xl font-bold text-[#12233f]">Auditoria e backups</h2><p className="mt-2 text-sm text-[#758492]">Acompanhe alterações feitas por cada pessoa e confirme se as cópias do banco estão sendo geradas.</p></div>
      <Badge className="bg-[#e5f3ef] px-3 py-1.5 text-[#10766c] hover:bg-[#e5f3ef]"><ShieldCheck className="mr-1.5 h-4 w-4" /> Somente o dono</Badge>
    </div>

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]">
      <Card className="border-[#e6eae9] bg-white shadow-[0_12px_32px_rgba(26,54,73,.055)]"><CardContent className="p-5 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-3"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#e7f4f1] text-[#14877e]"><ClipboardList className="h-5 w-5" /></div><div><h3 className="font-bold text-[#12233f]">Histórico de ações</h3><p className="text-xs text-[#647b79]">Entradas, mudanças e operações concluídas no login local.</p></div></div><label className="text-xs font-medium text-[#506273]">Funcionário <select aria-label="Filtrar funcionário" className="ml-2 rounded-lg border border-[#dce5e3] bg-white px-2 py-2 text-xs" value={staffAccountId ?? "all"} onChange={event => { setStaffAccountId(event.target.value === "all" ? undefined : Number(event.target.value)); setBeforeId(undefined); setPrevious([]); }}><option value="all">Toda a equipe</option>{people.data?.map(person => <option key={person.id} value={person.id}>{person.fullName}{person.role === "owner" ? " (dono)" : ""}</option>)}</select></label></div>
        {logs.isLoading && <p className="mt-6 text-sm text-[#647b79]">Carregando ações...</p>}
        {logs.isError && <p role="alert" className="mt-6 text-sm text-red-700">Não foi possível consultar o histórico. Verifique o banco e a migração.</p>}
        {!logs.isLoading && !logs.isError && !logs.data?.length && <p className="mt-6 rounded-xl bg-[#f6f8f7] p-5 text-sm text-[#647b79]">Nenhuma ação registrada nesse filtro. O registro começa após instalar esta atualização.</p>}
        <div className="mt-5 space-y-3">{logs.data?.map(event => <div key={event.id} className="flex gap-3 rounded-xl border border-[#edf1ef] p-3 sm:p-4"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#eef5f3] text-[#14877e]"><CalendarClock className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1"><strong className="text-sm text-[#12233f]">{event.summary}</strong><time className="text-xs text-[#80909c]" dateTime={new Date(event.occurredAt).toISOString()}>{dateTime(event.occurredAt)}</time></div><p className="mt-1 text-xs text-[#71808e]">{event.actorName} · {event.actorRole === "owner" ? "Dono" : "Funcionário"}{event.targetType && event.targetId ? ` · ${entityName[event.targetType] ?? event.targetType} #${event.targetId}` : ""}</p></div></div>)}</div>
        <div className="mt-5 flex items-center justify-between gap-3"><Button type="button" size="sm" variant="outline" disabled={!previous.length || logs.isFetching} onClick={() => { const stack = previous.slice(); setBeforeId(stack.pop()); setPrevious(stack); }}>Anterior</Button><span className="text-xs text-[#91a0aa]">Página {previous.length + 1}</span><Button type="button" size="sm" variant="outline" disabled={logs.isFetching || (logs.data?.length ?? 0) < 30} onClick={() => { setPrevious([...previous, beforeId]); setBeforeId(logs.data?.at(-1)?.id); }}>Próxima</Button></div>
      </CardContent></Card>
      <div className="space-y-6"><Card className="border-[#e6eae9] bg-white shadow-[0_12px_32px_rgba(26,54,73,.055)]"><CardContent className="p-5 sm:p-7"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#fff2df] text-[#af7745]"><DatabaseBackup className="h-5 w-5" /></div><div><h3 className="font-bold text-[#12233f]">Backup do banco</h3><p className="text-xs text-[#647b79]">Histórico do computador local.</p></div></div>
        {backups.isLoading && <p className="mt-5 text-sm text-[#647b79]">Carregando status...</p>}
        {backups.isError && <p role="alert" className="mt-5 text-sm text-red-700">Não foi possível consultar os backups.</p>}
        {!backups.isLoading && !backups.isError && !latest && <div className="mt-5 rounded-xl bg-[#fff8e9] p-4 text-sm text-[#7b6646]">Nenhum backup local registrado. Configure e execute o primeiro em seu computador.</div>}
        {latest && <div className={`mt-5 flex gap-3 rounded-xl p-4 ${latest.status === "success" ? "bg-[#edf8f3] text-[#246653]" : "bg-[#fdf0ec] text-[#a04e42]"}`}>{latest.status === "success" ? <CircleCheck className="mt-0.5 h-5 w-5 shrink-0" /> : <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />}<div><strong className="text-sm">{latest.status === "success" ? "Última execução: concluída" : "Última execução: falhou"}</strong><p className="mt-1 text-xs">{dateTime(latest.finishedAt)}{latest.filename ? ` · ${latest.filename}` : ""}</p></div></div>}
        {!!backups.data?.length && <div className="mt-4 space-y-2">{backups.data.slice(0, 5).map(run => <p key={run.id} className="flex justify-between gap-3 border-b border-[#edf1ef] py-2 text-xs"><span className="text-[#778794]">{dateTime(run.finishedAt)}</span><span className={run.status === "success" ? "font-semibold text-[#158265]" : "font-semibold text-red-700"}>{run.status === "success" ? "Verificado" : "Falhou"}</span></p>)}</div>}
      </CardContent></Card><Card className="border-[#e6eae9] bg-[#fffefb]"><CardContent className="p-5 sm:p-7"><div className="flex items-center gap-2"><ArchiveRestore className="h-5 w-5 text-[#14877e]" /><h3 className="font-bold text-[#12233f]">Como ativar no Windows</h3></div><p className="mt-3 text-xs leading-5 text-[#71808e]">O backup precisa ser agendado no computador que executa o MySQL; abrir o site não inicia uma cópia. Após atualizar o projeto, siga <strong>BACKUP.md</strong> para criar a chave e rodar a primeira cópia.</p><p className="mt-3 rounded-lg bg-[#eef5f3] p-3 font-mono text-xs text-[#486e69]">pnpm.cmd backup:run</p><p className="mt-2 text-xs leading-5 text-[#71808e]">O agendamento é opcional e funciona quando o computador está ligado e o usuário do Windows está conectado. Copie os arquivos criptografados e a chave para locais separados; backups no mesmo disco não protegem contra perda do computador.</p></CardContent></Card></div>
    </div>
  </div>;
}
