export const digitsOnly = (value: string) => value.replace(/\D/g, "");

/** Verifies the two Brazilian CPF check digits; invalid repeated-digit CPFs are rejected. */
export function isValidCpf(value: string): boolean {
  const cpf = digitsOnly(value);
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  for (const size of [9, 10]) {
    const total = Array.from(cpf.slice(0, size)).reduce((sum, digit, index) => sum + Number(digit) * (size + 1 - index), 0);
    const remainder = (total * 10) % 11;
    if ((remainder === 10 ? 0 : remainder) !== Number(cpf[size])) return false;
  }
  return true;
}

/** Normalizes DDD + number, accepting an optional +55 country code. */
export function normalizeBrazilianPhone(value: string): string {
  const digits = digitsOnly(value);
  return (digits.length === 12 || digits.length === 13) && digits.startsWith("55") ? digits.slice(2) : digits;
}
