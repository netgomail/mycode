import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

export type CheckStatus = 'pass' | 'fail' | 'warn' | 'unknown';

export interface CheckItem {
  id: string;
  category: string;
  title: string;
  hint: string;
  check: () => CheckStatus;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function readFile(path: string): string | null {
  try { return readFileSync(path, 'utf-8'); } catch { return null; }
}

/** Найти значение директивы в конфиге вида "Key Value" (ignoreCase) */
function sshConfigValue(content: string, key: string): string | null {
  const re = new RegExp(`^\\s*${key}\\s+(\\S+)`, 'im');
  const m = content.match(re);
  return m ? m[1].toLowerCase() : null;
}

function spawnCheck(args: string[]): boolean {
  try {
    const result = Bun.spawnSync(args, { stdout: 'pipe', stderr: 'pipe' });
    return result.exitCode === 0;
  } catch { return false; }
}

// ─── checks ───────────────────────────────────────────────────────────────────

function checkSshPermitRoot(): CheckStatus {
  const content = readFile('/etc/ssh/sshd_config');
  if (!content) return 'unknown';
  const val = sshConfigValue(content, 'PermitRootLogin');
  if (!val) return 'warn'; // не задано — зависит от дистрибутива
  return val === 'no' || val === 'prohibit-password' ? 'pass' : 'fail';
}

function checkSshPasswordAuth(): CheckStatus {
  const content = readFile('/etc/ssh/sshd_config');
  if (!content) return 'unknown';
  const val = sshConfigValue(content, 'PasswordAuthentication');
  if (!val) return 'warn';
  return val === 'no' ? 'pass' : 'fail';
}

function checkSshMaxAuthTries(): CheckStatus {
  const content = readFile('/etc/ssh/sshd_config');
  if (!content) return 'unknown';
  const val = sshConfigValue(content, 'MaxAuthTries');
  if (!val) return 'warn';
  const n = parseInt(val, 10);
  if (isNaN(n)) return 'unknown';
  return n <= 5 ? 'pass' : 'fail';
}

function checkPamMinLen(): CheckStatus {
  // пробуем pwquality.conf
  const pwq = readFile('/etc/security/pwquality.conf');
  if (pwq) {
    const m = pwq.match(/^\s*minlen\s*=\s*(\d+)/im);
    if (m) return parseInt(m[1], 10) >= 8 ? 'pass' : 'fail';
  }
  // пробуем pam_unix в common-password
  const common = readFile('/etc/pam.d/common-password');
  if (common) {
    const m = common.match(/minlen=(\d+)/i);
    if (m) return parseInt(m[1], 10) >= 8 ? 'pass' : 'fail';
  }
  return 'unknown';
}

function checkPamPwquality(): CheckStatus {
  const common = readFile('/etc/pam.d/common-password');
  if (!common) return 'unknown';
  return /pam_pwquality|pam_cracklib/.test(common) ? 'pass' : 'fail';
}

function checkFirewallUfw(): CheckStatus {
  if (!spawnCheck(['which', 'ufw'])) return 'unknown';
  return spawnCheck(['systemctl', 'is-active', '--quiet', 'ufw']) ? 'pass' : 'fail';
}

function checkAuditd(): CheckStatus {
  if (existsSync('/var/run/auditd.pid')) return 'pass';
  if (!spawnCheck(['which', 'systemctl'])) return 'unknown';
  return spawnCheck(['systemctl', 'is-active', '--quiet', 'auditd']) ? 'pass' : 'fail';
}

function checkUsbBlocked(): CheckStatus {
  const dirs = ['/etc/modprobe.d'];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    try {
      for (const file of readdirSync(dir)) {
        const content = readFile(join(dir, file));
        if (!content) continue;
        if (/^(blacklist|install)\s+usb[-_]storage/im.test(content)) return 'pass';
      }
    } catch { /* ignore */ }
  }
  return 'fail';
}

function checkKernelAslr(): CheckStatus {
  const val = readFile('/proc/sys/kernel/randomize_va_space')?.trim();
  if (!val) return 'unknown';
  return val === '2' ? 'pass' : (val === '1' ? 'warn' : 'fail');
}

function checkKernelSynCookies(): CheckStatus {
  const val = readFile('/proc/sys/net/ipv4/tcp_syncookies')?.trim();
  if (!val) return 'unknown';
  return val === '1' ? 'pass' : 'fail';
}

// ─── public API ───────────────────────────────────────────────────────────────

export function buildChecks(): CheckItem[] {
  return [
    {
      id: 'ssh-root',
      category: 'SSH',
      title: 'PermitRootLogin = no / prohibit-password',
      hint: 'Установите: PermitRootLogin no  в /etc/ssh/sshd_config',
      check: checkSshPermitRoot,
    },
    {
      id: 'ssh-passauth',
      category: 'SSH',
      title: 'PasswordAuthentication = no',
      hint: 'Установите: PasswordAuthentication no  в /etc/ssh/sshd_config',
      check: checkSshPasswordAuth,
    },
    {
      id: 'ssh-maxauth',
      category: 'SSH',
      title: 'MaxAuthTries ≤ 5',
      hint: 'Установите: MaxAuthTries 3  в /etc/ssh/sshd_config',
      check: checkSshMaxAuthTries,
    },
    {
      id: 'pam-minlen',
      category: 'PAM / Пароли',
      title: 'Минимальная длина пароля ≥ 8',
      hint: 'Установите minlen = 8  в /etc/security/pwquality.conf',
      check: checkPamMinLen,
    },
    {
      id: 'pam-pwquality',
      category: 'PAM / Пароли',
      title: 'pam_pwquality или pam_cracklib подключён',
      hint: 'Добавьте в /etc/pam.d/common-password: password requisite pam_pwquality.so',
      check: checkPamPwquality,
    },
    {
      id: 'firewall-ufw',
      category: 'Firewall',
      title: 'ufw активен',
      hint: 'Запустите: sudo ufw enable',
      check: checkFirewallUfw,
    },
    {
      id: 'auditd',
      category: 'auditd',
      title: 'Служба auditd запущена',
      hint: 'Установите и запустите: apt install auditd && systemctl enable --now auditd',
      check: checkAuditd,
    },
    {
      id: 'usb-blocked',
      category: 'USB',
      title: 'usb-storage заблокирован в modprobe',
      hint: 'Добавьте в /etc/modprobe.d/usb-block.conf: blacklist usb-storage',
      check: checkUsbBlocked,
    },
    {
      id: 'kernel-aslr',
      category: 'Ядро',
      title: 'ASLR включён (randomize_va_space = 2)',
      hint: 'Добавьте в /etc/sysctl.conf: kernel.randomize_va_space = 2',
      check: checkKernelAslr,
    },
    {
      id: 'kernel-syncookies',
      category: 'Ядро',
      title: 'SYN-cookies включены (tcp_syncookies = 1)',
      hint: 'Добавьте в /etc/sysctl.conf: net.ipv4.tcp_syncookies = 1',
      check: checkKernelSynCookies,
    },
  ];
}

export function statusIcon(s: CheckStatus): string {
  switch (s) {
    case 'pass':    return '✓';
    case 'fail':    return '✗';
    case 'warn':    return '⚠';
    case 'unknown': return '?';
  }
}

export function statusColor(s: CheckStatus): string {
  switch (s) {
    case 'pass':    return 'green';
    case 'fail':    return 'red';
    case 'warn':    return 'yellow';
    case 'unknown': return 'gray';
  }
}
