export interface PassOptions {
  length: number;       // default: 16
  symbols: boolean;     // default: false
  noAmbiguous: boolean; // default: false
  count: number;        // default: 1
}

export interface StrengthResult {
  score: 1 | 2 | 3 | 4 | 5;
  label: string;
  details: string[];
}

const LOWER     = 'abcdefghijklmnopqrstuvwxyz';
const UPPER     = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS    = '0123456789';
const SYMBOLS   = '!@#$%^&*()-_=+[]{}|;:,.<>?';
const AMBIGUOUS = 'l1IoO0';

export const DEFAULT_OPTS: PassOptions = {
  length: 16,
  symbols: false,
  noAmbiguous: false,
  count: 1,
};

function buildCharset(opts: PassOptions): string {
  let charset = LOWER + UPPER + DIGITS;
  if (opts.symbols) charset += SYMBOLS;
  if (opts.noAmbiguous) {
    for (const ch of AMBIGUOUS) charset = charset.split(ch).join('');
  }
  return charset;
}

export function generatePassword(opts: PassOptions): string {
  const charset = buildCharset(opts);
  if (charset.length === 0) return '';

  const arr = new Uint32Array(opts.length);
  crypto.getRandomValues(arr);

  let result = '';
  for (const n of arr) result += charset[n % charset.length];
  return result;
}

export function checkStrength(password: string): StrengthResult {
  const details: string[] = [];
  let points = 0;

  // Длина
  if (password.length >= 16)      { points += 3; details.push('длина ≥ 16'); }
  else if (password.length >= 12) { points += 2; details.push('длина ≥ 12'); }
  else if (password.length >= 8)  { points += 1; details.push('длина ≥ 8'); }
  else { details.push('длина < 8 — слишком короткий'); }

  // Разнообразие
  if (/[a-z]/.test(password)) { points++; details.push('строчные буквы'); }
  if (/[A-Z]/.test(password)) { points++; details.push('прописные буквы'); }
  if (/[0-9]/.test(password)) { points++; details.push('цифры'); }
  if (/[^a-zA-Z0-9]/.test(password)) { points += 2; details.push('спецсимволы'); }

  // Энтропия
  const charsetSize =
    (/[a-z]/.test(password) ? 26 : 0) +
    (/[A-Z]/.test(password) ? 26 : 0) +
    (/[0-9]/.test(password) ? 10 : 0) +
    (/[^a-zA-Z0-9]/.test(password) ? 32 : 0);

  const entropy = charsetSize > 0
    ? password.length * Math.log2(charsetSize)
    : 0;

  if (entropy >= 80) { points += 2; details.push(`энтропия ${entropy.toFixed(0)} бит`); }
  else if (entropy >= 50) { points++; details.push(`энтропия ${entropy.toFixed(0)} бит`); }
  else { details.push(`энтропия ${entropy.toFixed(0)} бит — мало`); }

  // Итоговая оценка 1–5
  const score: StrengthResult['score'] =
    points >= 10 ? 5 :
    points >= 7  ? 4 :
    points >= 5  ? 3 :
    points >= 3  ? 2 : 1;

  const labels: Record<StrengthResult['score'], string> = {
    1: 'очень слабый',
    2: 'слабый',
    3: 'средний',
    4: 'хороший',
    5: 'отличный',
  };

  return { score, label: labels[score], details };
}

// ─── парсинг аргументов /pass ──────────────────────────────────────────────

export function parsePassArgs(arg: string): { opts: PassOptions; checkMode: string | null } {
  const parts = arg.trim().split(/\s+/);
  const opts: PassOptions = { ...DEFAULT_OPTS };
  let checkMode: string | null = null;

  if (parts[0] === 'check') {
    // /pass check "password"
    checkMode = parts.slice(1).join(' ').replace(/^["']|["']$/g, '');
    return { opts, checkMode };
  }

  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p === '--symbols')       opts.symbols     = true;
    if (p === '--no-ambiguous')  opts.noAmbiguous = true;
    if (p === '--length' && parts[i + 1]) {
      const n = parseInt(parts[++i], 10);
      if (!isNaN(n) && n >= 4 && n <= 128) opts.length = n;
    }
    if (p === '--count' && parts[i + 1]) {
      const n = parseInt(parts[++i], 10);
      if (!isNaN(n) && n >= 1 && n <= 50) opts.count = n;
    }
  }

  return { opts, checkMode };
}
