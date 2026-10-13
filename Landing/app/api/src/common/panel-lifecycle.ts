// The lifecycle of a panel-rated stage (#78): which state it is in, what has to be true before
// it can move on, and the plain-words reasons when it cannot. Pure and DB-free.

export const PANEL_STATES = ['Draft', 'Ready', 'Open', 'Closed', 'Finalized', 'Selected', 'Released'] as const;
export type PanelState = (typeof PANEL_STATES)[number];

export const isPanelState = (v: string): v is PanelState => (PANEL_STATES as readonly string[]).includes(v);

export interface ReadyFacts {
  formPublished: boolean;
  formAssigned: boolean;
  panelists: number;
  requiredRaters: number;
  rosterSize: number;
}

/** What the "Ready" checklist still misses. Empty = the stage can be marked Ready. */
export function readyIssues(f: ReadyFacts): string[] {
  const out: string[] = [];
  if (!f.formAssigned) out.push('Choose the evaluation form for this stage.');
  else if (!f.formPublished) out.push('The evaluation form is not published yet.');
  if (f.requiredRaters < 1) out.push('Set how many raters each student needs.');
  if (f.panelists < Math.max(1, f.requiredRaters)) {
    out.push(`Add at least ${Math.max(1, f.requiredRaters)} panelist${f.requiredRaters === 1 ? '' : 's'} (${f.panelists} added).`);
  }
  if (f.rosterSize < 1) out.push('No student has qualified into this stage yet, so there is nobody to rate.');
  return out;
}

export interface OpenFacts {
  state: PanelState;
  /** The previous stage of the competition, when there is one. */
  previous: { position: number; name: string; decided: boolean } | null;
  /** Another panel stage of the same competition that is Open right now. */
  otherOpen: { position: number; name: string } | null;
}

/** Why a stage cannot be opened right now, in plain words. Empty = it can. */
export function openBlockers(f: OpenFacts): string[] {
  const out: string[] = [];
  if (f.state === 'Open') return ['This stage is already open.'];
  if (f.state === 'Draft') out.push('Finish the Ready checklist first.');
  if (f.state === 'Closed' || f.state === 'Finalized' || f.state === 'Selected' || f.state === 'Released') out.push('This stage is closed and locked. An administrator override is needed to open it again.');
  if (f.otherOpen) out.push(`Stage ${f.otherOpen.position} (${f.otherOpen.name}) is open. Close it before opening another stage.`);
  if (f.previous && !f.previous.decided) out.push(`Stage ${f.previous.position} (${f.previous.name}) is not closed with its selection committed yet.`);
  return out;
}

export interface CloseFacts {
  draftRatings: number;
  /** Students with fewer submitted ratings than required. */
  underRated: number;
  roster: number;
}

/** Warnings shown before a stage is closed; an admin has to confirm them. */
export function closeWarnings(f: CloseFacts): string[] {
  const out: string[] = [];
  if (f.draftRatings > 0) out.push(`${f.draftRatings} rating${f.draftRatings === 1 ? ' is' : 's are'} still a draft and will not count.`);
  if (f.underRated > 0) out.push(`${f.underRated} of ${f.roster} student${f.roster === 1 ? ' has' : 's have'} fewer ratings than required and will be Not rated.`);
  return out;
}

/** Where an override can send a stage back to. Once a selection is committed it cannot be undone, so Selected and Released are not here. */
export const OVERRIDE_TARGET: Record<string, PanelState> = { Closed: 'Open', Finalized: 'Closed' };

/** A stage that takes ratings: only while Open. */
export const acceptsRatings = (s: PanelState): boolean => s === 'Open';

/** A stage whose result may be used in a student's report: only once released. */
export const countsForReports = (s: PanelState): boolean => s === 'Released';
