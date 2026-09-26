/** A non-reusable enrollment identifier: stable for existing and future database rows. */
export function formatEnrollmentNumber(id: number): string {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Identificador de matrícula inválido");
  return `MAT-${String(id).padStart(8, "0")}`;
}
