import { spawnSync } from 'node:child_process';

interface Candidate {
  command: string;
  args: string[];
}

function candidates(): Candidate[] {
  switch (process.platform) {
    case 'darwin':
      return [{ command: 'pbcopy', args: [] }];
    case 'win32':
      return [{ command: 'clip', args: [] }];
    default:
      return [
        { command: 'wl-copy', args: [] },
        { command: 'xclip', args: ['-selection', 'clipboard'] },
        { command: 'xsel', args: ['--clipboard', '--input'] },
      ];
  }
}

/** Best-effort clipboard write. Returns false when no helper worked. */
export function copyToClipboard(text: string): boolean {
  for (const candidate of candidates()) {
    try {
      const result = spawnSync(candidate.command, candidate.args, {
        input: text,
        stdio: ['pipe', 'ignore', 'ignore'],
        shell: process.platform === 'win32',
        windowsHide: true,
      });
      if (result.error === undefined && result.status === 0) return true;
    } catch {
      // try the next helper
    }
  }
  return false;
}
