import "dotenv/config";
import { input, password, confirm } from "@inquirer/prompts";
import { resetOwnerPassword, validateNewPassword } from "../server/localAccounts";

function requireLocalDatabase() {
  if (!process.env.DATABASE_URL) throw new Error("Configure DATABASE_URL no .env antes de iniciar.");
  const dbUrl = new URL(process.env.DATABASE_URL);
  if (!["localhost", "127.0.0.1", "::1"].includes(dbUrl.hostname)) {
    throw new Error("Por segurança, a recuperação só pode usar um banco MySQL no computador local.");
  }
  if ((process.env.JWT_SECRET?.length ?? 0) < 32) throw new Error("Configure JWT_SECRET (pelo menos 32 caracteres) no .env.");
}

async function main() {
  if (!process.stdin.isTTY) throw new Error("Execute este comando em um terminal interativo local.");
  requireLocalDatabase();
  console.log("Recuperação da conta do dono — a senha nunca será exibida nem salva nesta conversa.\n");
  const username = await input({ message: "Nome de usuário do dono:", validate: value => value.trim().length >= 2 || "Informe o nome de usuário." });
  const confirmation = await input({ message: "Para confirmar, digite exatamente REDEFINIR DONO:" });
  if (confirmation !== "REDEFINIR DONO") {
    console.log("Operação cancelada. Nenhuma senha foi alterada.");
    return;
  }
  const newPassword = await password({ message: "Nova senha (15 a 128 caracteres):", validate: value => {
    try { validateNewPassword(value); return true; } catch { return "Use uma senha de 15 a 128 caracteres."; }
  } });
  const repeated = await password({ message: "Repita a nova senha:", validate: value => value === newPassword || "As senhas não coincidem." });
  if (repeated !== newPassword || !await confirm({ message: "Redefinir a senha deste dono e encerrar sessões antigas?", default: false })) {
    console.log("Operação cancelada. Nenhuma senha foi alterada.");
    return;
  }
  const owner = await resetOwnerPassword({ username, newPassword });
  console.log(`Senha redefinida com sucesso para ${owner.username}. Todas as sessões antigas foram encerradas.`);
}

main().then(() => process.exit(0)).catch(error => {
  console.error(error instanceof Error ? error.message : "Falha ao redefinir a senha do dono.");
  process.exit(1);
});
