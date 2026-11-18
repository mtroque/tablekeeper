// The Screens workflow's PR comment and folder index (W10): which shots differ from `main`.

export const SCREENS_COMMENT_MARKER = '<!-- screens -->';
export const MAX_EMBEDDED = 30;

export type ShotInfo = { id: string; screen: string; state: string; hash: string };

export type ReportInput = {
  /** Shots this run produced, in map order. */
  shots: readonly ShotInfo[];
  /** Map entry ids with no shot (the entry failed to reach its state). */
  missing: readonly string[];
  /** id → hash of the `main` set, or null when there is no baseline yet. */
  baseline: ReadonlyMap<string, string> | null;
  /** Raw URL of this run's folder on the `screens` branch, without a trailing slash. */
  rawBase: string;
  /** Browsable URL of this run's folder (its README lists every shot). */
  folderUrl: string;
  sha: string;
};

export function changedShots(
  shots: readonly ShotInfo[],
  baseline: ReadonlyMap<string, string> | null,
): ShotInfo[] {
  if (baseline === null) return [...shots];
  return shots.filter((shot) => baseline.get(shot.id) !== shot.hash);
}

function cell(shot: ShotInfo, rawBase: string): string {
  return `**${shot.id}** (${shot.screen}, ${shot.state})<br><img src="${rawBase}/${shot.id}.png" width="195" alt="${shot.id}">`;
}

/** Shots two to a row. */
function grid(shots: readonly ShotInfo[], rawBase: string): string[] {
  const rows = ['| | |', '|---|---|'];
  for (let i = 0; i < shots.length; i += 2) {
    const [left, right] = [shots[i], shots[i + 1]];
    if (!left) break;
    rows.push(`| ${cell(left, rawBase)} | ${right ? cell(right, rawBase) : ''} |`);
  }
  return rows;
}

export function renderComment(input: ReportInput): string {
  const changed = changedShots(input.shots, input.baseline);
  const short = input.sha.slice(0, 7);
  const lines = [SCREENS_COMMENT_MARKER, '### Screens', ''];
  const all = `[All ${String(input.shots.length)} screens](${input.folderUrl})`;
  if (input.baseline === null) {
    lines.push(
      `No \`main\` set to compare with yet, so every screen is shown. ${all} at ${short}.`,
    );
  } else if (changed.length === 0) {
    lines.push(`No screen differs from \`main\`. ${all} at ${short}.`);
  } else {
    lines.push(
      `${String(changed.length)} of ${String(input.shots.length)} screens differ from \`main\`. ${all} at ${short}.`,
    );
  }
  if (input.missing.length > 0) {
    lines.push(
      '',
      `**Not reached** (see the job log): ${input.missing.map((id) => `\`${id}\``).join(', ')}`,
    );
  }
  const embedded = changed.slice(0, MAX_EMBEDDED);
  if (embedded.length > 0) lines.push('', ...grid(embedded, input.rawBase));
  const rest = changed.slice(MAX_EMBEDDED);
  if (rest.length > 0) {
    lines.push(
      '',
      `Also changed: ${rest.map((shot) => `[${shot.id}](${input.rawBase}/${shot.id}.png)`).join(', ')}`,
    );
  }
  return `${lines.join('\n')}\n`;
}

/** The folder's README: every shot, so the full set reads like a contact sheet. */
export function renderIndex(shots: readonly ShotInfo[], sha: string): string {
  const lines = [`# Screens at ${sha.slice(0, 7)}`, '', ...grid(shots, '.')];
  return `${lines.join('\n')}\n`;
}
