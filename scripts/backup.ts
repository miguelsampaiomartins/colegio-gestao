import "dotenv/config";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { backupRuns } from "../drizzle/schema";
import { getDb } from "../server/db";
import { backupDirectory, backupKey, createEncryptedBackup, findMysqlBinary, restoreIntoEmptyTestDb, verifyBackup } from "./backup-core";

const command = process.argv[2] || "run";
const file = process.argv[3];

async function saveRun(input: typeof backupRuns.$inferInsert) {
  try {
    const db = await getDb();
    if (!db) throw new Error("Banco indisponível");
    await db.insert(backupRuns).values(input);
  } catch {
    console.warn("Não foi possível atualizar o status no painel; confira pnpm.cmd db:push e DATABASE_URL.");
  }
}

async function main() {
  if (command === "keygen") {
    console.log("BACKUP_KEY=" + randomBytes(32).toString("base64"));
    console.log("Guarde esta chave fora do Git e em outro dispositivo; sem ela não é possível restaurar o backup.");
    return;
  }
  const key = backupKey();
  if (command === "verify") {
    if (!file) throw new Error("Uso: pnpm.cmd backup:verify CAMINHO_DO_ARQUIVO.sql.gcm");
    const result = await verifyBackup(resolve(file), key);
    console.log(`Integridade verificada: ${result.bytes} bytes criptografados; ${result.plainBytes} bytes SQL.`);
    return;
  }
  if (command === "restore:test") {
    if (!file || !process.env.BACKUP_RESTORE_TEST_URL) throw new Error("Informe o arquivo e BACKUP_RESTORE_TEST_URL apontando a um banco vazio com sufixo _restore_test.");
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL ausente.");
    await restoreIntoEmptyTestDb({ file: resolve(file), key, targetUrl: process.env.BACKUP_RESTORE_TEST_URL, liveUrl: process.env.DATABASE_URL, mysqlBinary: await findMysqlBinary("mysql") });
    console.log("Restauração de teste concluída no banco vazio. Confira as tabelas no MySQL Workbench.");
    return;
  }
  if (command !== "run") throw new Error(`Comando desconhecido: ${command}`);
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL ausente.");
  const startedAt = Date.now();
  try {
    const result = await createEncryptedBackup({ url: process.env.DATABASE_URL, key, directory: backupDirectory(), dumpBinary: await findMysqlBinary("mysqldump") });
    await saveRun({ status: "success", filename: result.filename, bytes: result.bytes, startedAt, finishedAt: Date.now(), message: "Backup criptografado e verificado" });
    console.log(`Backup pronto: ${result.path} (${result.bytes} bytes).`);
  } catch (error) {
    await saveRun({ status: "failure", startedAt, finishedAt: Date.now(), message: "Falha na exportação ou na verificação; confira o terminal da tarefa." });
    throw error;
  }
}

main().then(() => process.exit(0)).catch(error => {
  // Never print the connection URL, dump command or environment variables.
  console.error(error instanceof Error ? error.message.replace(/mysql:\/\/[^\s]+/gi, "[DATABASE_URL ocultada]") : "Falha no backup.");
  process.exit(1);
});
