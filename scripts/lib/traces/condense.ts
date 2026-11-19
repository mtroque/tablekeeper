import { clip } from './args';
import type { GradedSession, ToolEvent, TraceClass } from './types';

const RUN_KEEP_HEAD = 2;
const RUN_KEEP_TAIL = 1;

function toolLine(event: ToolEvent): string {
  return `T: ${event.name}${event.arg ? `: ${event.arg}` : ''}`;
}

function summarizeRun(run: readonly ToolEvent[]): string[] {
  if (run.length <= RUN_KEEP_HEAD + RUN_KEEP_TAIL + 1) return run.map(toolLine);
  const hidden = run.slice(RUN_KEEP_HEAD, run.length - RUN_KEEP_TAIL);
  const byName = new Map<string, number>();
  for (const e of hidden) byName.set(e.name, (byName.get(e.name) ?? 0) + 1);
  const names = [...byName.entries()].map(([n, c]) => `${n} ${c}`).join(', ');
  return [
    ...run.slice(0, RUN_KEEP_HEAD).map(toolLine),
    `T: ... ${hidden.length} more calls (${names})`,
    ...run.slice(run.length - RUN_KEEP_TAIL).map(toolLine),
  ];
}

/**
 * Renders a graded session as a compact text trace for the judge: a header with metrics, user
 * turns, tool calls (long runs of successful calls summarized), each error with its class, and
 * the final message. Never committed or published: it holds transcript text.
 */
export function condenseSession(graded: GradedSession, maxChars = 12_000): string {
  const { session, metrics } = graded;
  const classAt = new Map<number, TraceClass[]>();
  for (const f of graded.findings)
    classAt.set(f.eventIndex, [...(classAt.get(f.eventIndex) ?? []), f.cls]);

  const lines = [
    `session ${session.id} runner=${session.runner} branch=${session.branch ?? '-'} start=${session.startedAt ?? '-'} end=${session.endedAt ?? '-'}`,
    `calls=${metrics.toolCalls} failed=${metrics.failed} userTurns=${metrics.userTurns} interrupts=${metrics.interruptions} models=${session.models.join(',') || '-'}`,
    '',
  ];
  let run: ToolEvent[] = [];
  const flush = (): void => {
    lines.push(...summarizeRun(run));
    run = [];
  };

  session.events.forEach((event, index) => {
    const classes = classAt.get(index);
    if (event.kind === 'tool' && !classes && event.error === null) {
      run.push(event);
      return;
    }
    flush();
    if (event.kind === 'user') lines.push(`U: ${event.text}`);
    else if (event.kind === 'interrupt') lines.push('U: [interrupted]');
    else if (event.kind === 'final') lines.push(`F: ${event.text}`);
    else {
      lines.push(toolLine(event));
      const tag = classes ? ` [${classes.join(', ')}]` : '';
      if (event.error !== null) lines.push(`  !${tag} ${clip(event.error, 240)}`);
      else if (tag) lines.push(`  ~${tag}`);
    }
  });
  flush();

  const text = lines.join('\n');
  if (text.length <= maxChars) return text;
  const half = Math.floor((maxChars - 40) / 2);
  return `${text.slice(0, half)}\n... [${text.length - 2 * half} chars cut] ...\n${text.slice(-half)}`;
}
