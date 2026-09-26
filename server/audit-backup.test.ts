import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { actionLabels, safeTargetId } from "./audit";
import { backupDirectory, backupKey, createEncryptedBackup, mysqlOptions, restoreIntoEmptyTestDb, verifyBackup } from "../scripts/backup-core";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

let root: string | undefined;
afterEach(async () => { if (root) await rm(root, { recursive: true, force: true }); root = undefined; });

describe("auditoria", () => {
  it("does not include sensitive form fields, only numeric identifiers", () => {
    const input = { id: 17, password: "secret", cpf: "12345678901", address: "Rua ...", note: "private" };
    expect(safeTargetId(input)).toBe(17);
    expect(safeTargetId({ username: "amanda", password: "secret" })).toBeNull();
    expect(JSON.stringify(actionLabels)).not.toMatch(/passwordHash|cpf|address|secret/i);
  });
  it("rejects unauthorized staff access to the history and backups", async () => {
    const ctx = { user: { id: 21, name: "Amanda" }, localRole: "staff", req: {}, res: {} } as TrpcContext;
    const caller = appRouter.createCaller(ctx);
    await expect(caller.audit.list({})).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.audit.backups()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("backup criptografado", () => {
  it("only accepts valid Base64 keys and keeps dumps out of the project tree", () => {
    const key = randomBytes(32).toString("base64");
    expect(backupKey({ BACKUP_KEY: key })).toHaveLength(32);
    expect(() => backupKey({ BACKUP_KEY: "weak" })).toThrow();
    expect(() => backupDirectory({ BACKUP_DIR: path.join(process.cwd(), "backups") })).toThrow();
  });
  it("decodes URL encoded MySQL passwords without printing them", () => {
    const options = mysqlOptions("mysql://colegio_app:minha%40senha@127.0.0.1:3306/colegio_local");
    expect(options).toMatchObject({ host: "127.0.0.1", user: "colegio_app", password: "minha@senha", database: "colegio_local" });
  });
  it("encrypts a streaming SQL dump, detects tampering and wrong keys, never writes plaintext", async () => {
    root = await mkdtemp(path.join(tmpdir(), "school-backup-"));
    const executable = path.join(root, "fake-dump");
    await writeFile(executable, "#!/usr/bin/env node\nprocess.stdout.write('-- fixture\\n' + 'CREATE TABLE test (id INT);\\n'.repeat(20));\n");
    await chmod(executable, 0o700);
    const key = randomBytes(32);
    const directory = path.join(root, "encrypted");
    const result = await createEncryptedBackup({ url: "mysql://demo:demo@127.0.0.1:3306/school_test", key, directory, dumpBinary: executable });
    const ciphertext = await readFile(result.path);
    expect(ciphertext.subarray(0, 5).toString()).toBe("CGDB1");
    expect(ciphertext.toString()).not.toContain("CREATE TABLE");
    expect(await verifyBackup(result.path, key)).toMatchObject({ bytes: ciphertext.length });
    await expect(verifyBackup(result.path, randomBytes(32))).rejects.toThrow();
    ciphertext[32] ^= 1;
    await writeFile(result.path, ciphertext);
    await expect(verifyBackup(result.path, key)).rejects.toThrow();
    await expect(restoreIntoEmptyTestDb({ file: result.path, key, targetUrl: "mysql://demo:demo@127.0.0.1:3306/school_live", mysqlBinary: "mysql" })).rejects.toThrow(/_restore_test/);
    await expect((await import("node:fs/promises")).readdir(directory).then(files => files.filter(name => name.endsWith(".partial")))).resolves.toEqual([]);
  });
});
