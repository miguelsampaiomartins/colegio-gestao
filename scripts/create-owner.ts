import "dotenv/config";
import { input, password, confirm } from "@inquirer/prompts";
import { eq } from "drizzle-orm";
import { staffAccounts } from "../drizzle/schema";
import { getDb } from "../server/db";
import { createFirstOwner, makeUsername, validateNewPassword } from "../server/localAccounts";

async function main() {
  if (!process.stdin.isTTY) throw new Error("Execute este comando em um terminal interativo local.");
  if (!process.env.DATABASE_URL) throw new Error("Configure DATABASE_URL no .env antes de iniciar.");
  const dbUrl = new URL(process.env.DATABASE_URL);
  if (!["localhost", "127.0.0.1", "::1"].includes(dbUrl.hostname)) {
    throw new Error("Por segurança, este assistente inicializa somente o banco MySQL no seu computador.");
  }
  if ((process.env.JWT_SECRET?.length ?? 0) < 32) throw new Error("Configure JWT_SECRET (pelo menos 32 caracteres) no .env.");
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível. Confira DATABASE_URL e a migração.");
  const [existing] = await db.select({ id: staffAccounts.id }).from(staffAccounts).where(eq(staffAccounts.ownerSlot, 1)).limit(1);
  if (existing) throw new Error("Já existe um dono no banco. Este assistente não pode criar um segundo dono.");
  console.log("Criando a conta do dono. O CPF completo não é solicitado nem armazenado.\n");
  const fullName = await input({ message: "Nome completo do dono:", validate: value => value.trim().length >= 2 || "Informe um nome válido." });
  const firstName = fullName.trim().split(/\s+/)[0];
  const cpfFirstFour = await input({ message: "Somente os quatro primeiros dígitos do CPF:", validate: value => /^\d{4}$/.test(value) || "Digite exatamente quatro dígitos." });
  const username = makeUsername(firstName, cpfFirstFour);
  console.log(`Nome de usuário: ${username}`);
  const initialPassword = await password({ message: "Crie uma senha forte (15 a 128 caracteres):", validate: value => {
    try { validateNewPassword(value); return true; } catch { return "Use de 15 a 128 caracteres."; }
  } });
  const repeat = await password({ message: "Repita a senha:", validate: value => value === initialPassword || "As senhas não coincidem." });
  if (!repeat || !await confirm({ message: `Criar a conta ${username} neste banco local?`, default: false })) {
    console.log("Operação cancelada. Nenhum dado foi inserido.");
    return;
  }
  const created = await createFirstOwner({ firstName, cpfFirstFour, fullName, password: initialPassword });
  console.log(`Conta do dono criada com sucesso: ${created}. Guarde sua senha em local seguro.`);
}

main().then(() => process.exit(0)).catch(error => {
  console.error(error instanceof Error ? error.message : "Falha ao criar o dono.");
  process.exit(1);
});
