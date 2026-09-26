import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, open, rename, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Transform, Writable } from "node:stream";
import { createConnection } from "mysql2/promise";

const MAGIC = Buffer.from("CGDB1");
const IV_SIZE = 12;
const TAG_SIZE = 16;
const HEADER_SIZE = MAGIC.length + IV_SIZE;

export function backupDirectory(env = process.env) {
  const directory = path.resolve(env.BACKUP_DIR || path.join(os.homedir(), "ColegioGestaoBackups"));
  const project = path.resolve(process.cwd());
  if (directory === project || directory.startsWith(project + path.sep)) throw new Error("BACKUP_DIR deve ficar fora da pasta do projeto.");
  return directory;
}

export function backupKey(env = process.env) {
  const value = env.BACKUP_KEY;
  if (!value || !/^[A-Za-z0-9+/]{43}=$/.test(value)) throw new Error("Configure BACKUP_KEY no .env com uma chave Base64 de 32 bytes.");
  const key = Buffer.from(value, "base64");
  if (key.length !== 32 || key.toString("base64") !== value) throw new Error("BACKUP_KEY inválida.");
  return key;
}

export function mysqlOptions(urlValue: string) {
  let url: URL;
  try { url = new URL(urlValue); } catch { throw new Error("DATABASE_URL inválida."); }
  if (url.protocol !== "mysql:") throw new Error("A URL deve começar com mysql://.");
  const database = decodeURIComponent(url.pathname.slice(1));
  if (!database || !/^[A-Za-z0-9_]+$/.test(database)) throw new Error("Nome do banco MySQL inválido.");
  const port = Number(url.port || "3306");
  if (!url.hostname || !Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error("Servidor ou porta inválidos.");
  return { host: url.hostname, port, user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database };
}

export async function findMysqlBinary(name: "mysqldump" | "mysql", env = process.env) {
  const override = env[name === "mysql" ? "MYSQL_CLIENT_PATH" : "MYSQLDUMP_PATH"];
  if (override) return override;
  if (process.platform !== "win32") return name;
  const { readdir, access } = await import("node:fs/promises");
  const root = path.join(env.ProgramFiles || "C:\\Program Files", "MySQL");
  let entries: string[] = [];
  try { entries = (await readdir(root)).filter(entry => entry.startsWith("MySQL Server ")).sort().reverse(); } catch { /* PATH fallback */ }
  for (const entry of entries) {
    const binary = path.join(root, entry, "bin", `${name}.exe`);
    try { await access(binary); return binary; } catch { /* try next version */ }
  }
  return `${name}.exe`;
}

function waitForExit(child: ReturnType<typeof spawn>) {
  return new Promise<void>((resolve, reject) => {
    let stderr = "";
    child.stderr?.on("data", chunk => { stderr = (stderr + String(chunk)).slice(-1500); });
    child.once("error", reject);
    child.once("close", code => code === 0 ? resolve() : reject(new Error(`Cliente MySQL terminou com código ${code}: ${stderr.replace(/password=[^\s]+/gi, "password=[redacted]")}`)));
  });
}

/** File layout: magic (5) + IV (12) + AES-256-GCM ciphertext + auth tag (16). */
export async function verifyBackup(file: string, key: Buffer) {
  const fileStat = await stat(file);
  if (fileStat.size < HEADER_SIZE + TAG_SIZE + 100) throw new Error("Arquivo de backup incompleto.");
  const handle = await open(file, "r");
  const header = Buffer.alloc(HEADER_SIZE);
  const tag = Buffer.alloc(TAG_SIZE);
  try {
    await handle.read(header, 0, HEADER_SIZE, 0);
    await handle.read(tag, 0, TAG_SIZE, fileStat.size - TAG_SIZE);
  } finally { await handle.close(); }
  if (!header.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error("Formato de backup desconhecido.");
  const decipher = createDecipheriv("aes-256-gcm", key, header.subarray(MAGIC.length));
  decipher.setAuthTag(tag);
  let plainBytes = 0;
  await pipeline(
    createReadStream(file, { start: HEADER_SIZE, end: fileStat.size - TAG_SIZE - 1 }),
    decipher,
    new Writable({ write(chunk, _encoding, callback) { plainBytes += chunk.length; callback(); } }),
  );
  if (plainBytes < 100) throw new Error("Backup vazio.");
  return { bytes: fileStat.size, plainBytes };
}

export async function createEncryptedBackup(options: { url: string; key: Buffer; directory: string; dumpBinary: string; now?: Date }) {
  const db = mysqlOptions(options.url);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(db.host.toLowerCase())) {
    throw new Error("Backup automático limitado ao MySQL local. Verifique DATABASE_URL antes de continuar.");
  }
  const date = options.now || new Date();
  const name = `colegio-${date.toISOString().replace(/[:.]/g, "-")}-${randomBytes(4).toString("hex")}.sql.gcm`;
  const finalPath = path.join(options.directory, name);
  const tempPath = `${finalPath}.partial`;
  await mkdir(options.directory, { recursive: true, mode: 0o700 });
  const iv = randomBytes(IV_SIZE);
  const cipher = createCipheriv("aes-256-gcm", options.key, iv);
  const output = createWriteStream(tempPath, { flags: "wx", mode: 0o600 });
  output.write(Buffer.concat([MAGIC, iv]));
  const child = spawn(options.dumpBinary, [
    "--no-defaults", `--host=${db.host}`, `--port=${db.port}`, `--user=${db.user}`,
    "--single-transaction", "--quick", "--skip-lock-tables", "--no-tablespaces",
    "--default-character-set=utf8mb4", db.database,
  ], { shell: false, windowsHide: true, env: { ...process.env, MYSQL_PWD: db.password }, stdio: ["ignore", "pipe", "pipe"] });
  const exited = waitForExit(child);
  let plainBytes = 0;
  const meter = new Transform({ transform(chunk, _encoding, callback) { plainBytes += chunk.length; callback(null, chunk); } });
  try {
    if (!child.stdout) throw new Error("Cliente mysqldump sem saída.");
    await Promise.all([pipeline(child.stdout, meter, cipher, output, { end: false }), exited]);
    if (plainBytes < 100) throw new Error("O banco retornou um backup vazio.");
    await new Promise<void>((resolve, reject) => output.write(cipher.getAuthTag(), error => error ? reject(error) : resolve()));
    await new Promise<void>((resolve, reject) => { output.once("error", reject); output.end(() => resolve()); });
    await verifyBackup(tempPath, options.key);
    await rename(tempPath, finalPath);
    return { filename: name, path: finalPath, bytes: (await stat(finalPath)).size };
  } catch (error) {
    child.kill(); output.destroy();
    await rm(tempPath, { force: true });
    throw error;
  }
}

/** Requires a separate, empty database whose name ends with _restore_test. */
export async function restoreIntoEmptyTestDb(options: { file: string; key: Buffer; targetUrl: string; mysqlBinary: string; liveUrl?: string }) {
  const target = mysqlOptions(options.targetUrl);
  if (!target.database.endsWith("_restore_test")) throw new Error("O nome do banco de teste deve terminar em _restore_test.");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(target.host.toLowerCase())) throw new Error("A restauração de teste está limitada ao MySQL local.");
  const live = options.liveUrl ? mysqlOptions(options.liveUrl) : null;
  if (live && target.host === live.host && target.port === live.port && target.database === live.database) throw new Error("Não é permitido restaurar no banco ativo.");
  // Authenticate the *entire* ciphertext before sending any SQL to MySQL.
  await verifyBackup(options.file, options.key);
  const connection = await createConnection({ host: target.host, port: target.port, user: target.user, password: target.password, database: target.database });
  try {
    const [tables] = await connection.query("SHOW TABLES");
    if ((tables as unknown[]).length) throw new Error("O banco de teste não está vazio. Não apagamos tabelas automaticamente.");
  } finally { await connection.end(); }
  const size = (await stat(options.file)).size;
  const handle = await open(options.file, "r");
  const header = Buffer.alloc(HEADER_SIZE);
  const tag = Buffer.alloc(TAG_SIZE);
  try { await handle.read(header, 0, HEADER_SIZE, 0); await handle.read(tag, 0, TAG_SIZE, size - TAG_SIZE); }
  finally { await handle.close(); }
  const decipher = createDecipheriv("aes-256-gcm", options.key, header.subarray(MAGIC.length));
  decipher.setAuthTag(tag);
  const child = spawn(options.mysqlBinary, ["--no-defaults", `--host=${target.host}`, `--port=${target.port}`, `--user=${target.user}`, "--default-character-set=utf8mb4", target.database], {
    shell: false, windowsHide: true, env: { ...process.env, MYSQL_PWD: target.password }, stdio: ["pipe", "ignore", "pipe"],
  });
  const exited = waitForExit(child);
  try {
    if (!child.stdin) throw new Error("Cliente MySQL sem entrada.");
    await Promise.all([pipeline(createReadStream(options.file, { start: HEADER_SIZE, end: size - TAG_SIZE - 1 }), decipher, child.stdin), exited]);
    return true;
  } catch (error) { child.kill(); throw error; }
}
