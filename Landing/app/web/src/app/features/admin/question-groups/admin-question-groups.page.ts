import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ADMIN_UI_CSS } from '../admin-ui';
import { MediaLibraryModal } from '../media-library-modal';
import { QuestionGroupHeaderComponent } from '../../../shared/question-group-header.component';
import {
  GroupCandidate,
  QuestionGroupRow,
  QuestionGroupsApi,
  errText,
  plainText,
} from './question-groups-admin.service';

interface PickedQuestion {
  code: string;
  prompt: string;
}

interface Editor {
  code: string | null;
  title: string;
  description: string;
  imageUrl: string;
  videoUrl: string;
  competitionCode: string;
  category: string;
  active: boolean;
  questions: PickedQuestion[];
  /** A live exam is running for the competition: questions can't change. */
  locked: boolean;
}

const MIN_QUESTIONS = 2;

@Component({
  selector: 'app-admin-question-groups',
  standalone: true,
  imports: [FormsModule, MediaLibraryModal, QuestionGroupHeaderComponent],
  template: `
    @if (error()) {
      <div class="err">{{ error() }}</div>
    }

    <p class="intro">
      A question group is a topic (title, description, image or video) with 2 or more existing questions under it. In the exam the
      student sees the group's header above each of its questions. Each question still counts as one question and one mark, so a
      group of 4 uses 4 of the exam's question slots.
    </p>

    <div class="bar">
      <input class="search" placeholder="Search by title or code" [ngModel]="search()" (ngModelChange)="search.set($event); reload()" />
      <select class="filter" [ngModel]="compFilter()" (ngModelChange)="compFilter.set($event); reload()" aria-label="Competition">
        <option value="">All competitions</option>
        @for (c of competitions(); track c.code) {
          <option [value]="c.code">{{ c.title }} ({{ c.code }})</option>
        }
      </select>
      <select class="filter" [ngModel]="catFilter()" (ngModelChange)="catFilter.set($event); reload()" aria-label="Category">
        <option value="">All categories</option>
        @for (c of categories(); track c) {
          <option [value]="c">{{ c }}</option>
        }
      </select>
      <select class="filter" [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event); reload()" aria-label="Status">
        <option value="">Any status</option>
        <option>Active</option>
        <option>Inactive</option>
      </select>
      <div class="grow"></div>
      <button class="btn btn-gold" (click)="openNew()">+ New group</button>
    </div>

    @if (loading()) {
      <div class="empty">Loading…</div>
    } @else if (!rows().length) {
      <div class="card empty">No question groups yet. Use "+ New group" to create one from existing questions.</div>
    } @else {
      <div class="tbl-wrap">
        <table>
          <thead>
            <tr><th>Group</th><th>Competition</th><th>Category</th><th>Questions</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            @for (g of rows(); track g.code) {
              <tr>
                <td data-label="Group"><span class="b">{{ g.title }}</span><small>{{ g.code }}</small></td>
                <td data-label="Competition">{{ g.competition || '—' }}<small>{{ g.competitionCode }}</small></td>
                <td data-label="Category"><span class="bdg blue">{{ g.category }}</span></td>
                <td data-label="Questions">
                  {{ g.questionCount }}
                  @if (!g.ready) {
                    <small class="warn">needs {{ MIN }}+</small>
                  }
                </td>
                <td data-label="Status">
                  <span class="bdg" [class.green]="g.active" [class.grey]="!g.active">{{ g.active ? 'Active' : 'Inactive' }}</span>
                </td>
                <td>
                  <div class="acts">
                    <button class="btn btn-sm" (click)="openEdit(g)">Edit</button>
                    <button class="btn btn-sm btn-danger" (click)="remove(g)">Delete</button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <div class="pager">
        <span>{{ (page() - 1) * limit + 1 }}–{{ Math.min(page() * limit, total()) }} of {{ total() }}</span>
        <button class="btn btn-sm" [disabled]="page() <= 1" (click)="go(page() - 1)">Previous</button>
        <button class="btn btn-sm" [disabled]="page() * limit >= total()" (click)="go(page() + 1)">Next</button>
      </div>
    }

    @if (editor(); as e) {
      <div class="modal-root" (click)="close()">
        <div class="modal wide" (click)="$event.stopPropagation()">
          <div class="m-head">
            <h3>{{ e.code ? 'Edit group ' + e.code : 'New question group' }}</h3>
            <button class="m-x" (click)="close()" aria-label="Close">✕</button>
          </div>
          <div class="m-body">
            @if (modalError()) {
              <div class="err">{{ modalError() }}</div>
            }
            @if (e.locked) {
              <div class="lock-note">
                A live exam is running for this competition, so this group's questions can't be changed right now. You can still edit its
                title, description, media and status.
              </div>
            }

            <div class="f full">
              <label for="qg-title">Title</label>
              <input id="qg-title" type="text" [(ngModel)]="e.title" maxlength="190" placeholder="e.g. Read the passage about rivers" />
            </div>

            <div class="f-row">
              <div class="f">
                <label for="qg-comp">Competition</label>
                <select id="qg-comp" [(ngModel)]="e.competitionCode" (ngModelChange)="identityChanged()" [disabled]="e.questions.length > 0 || e.locked">
                  <option value="">Choose…</option>
                  @for (c of competitions(); track c.code) {
                    <option [value]="c.code">{{ c.title }} ({{ c.code }})</option>
                  }
                </select>
              </div>
              <div class="f">
                <label for="qg-cat">Category</label>
                <select id="qg-cat" [(ngModel)]="e.category" (ngModelChange)="identityChanged()" [disabled]="e.questions.length > 0 || e.locked">
                  <option value="">Choose…</option>
                  @for (c of categoryOptions(e.category); track c) {
                    <option [value]="c">{{ c }}</option>
                  }
                </select>
              </div>
            </div>
            @if (e.questions.length > 0 && !e.locked) {
              <div class="hint" style="margin:-0.4rem 0 0.9rem">Remove all of the group's questions below to change its competition or category.</div>
            }

            <div class="f full">
              <label for="qg-desc">Description <small>(shown to students above each question)</small></label>
              <textarea id="qg-desc" [(ngModel)]="e.description" placeholder="The passage, case or context the questions refer to"></textarea>
            </div>

            <div class="f-row">
              <div class="f">
                <label>Image <small>(optional)</small></label>
                <div class="img-pick">
                  @if (e.imageUrl) {
                    <img class="img-pick-thumb" [src]="e.imageUrl" alt="" />
                  } @else {
                    <div class="img-pick-thumb empty-thumb">None</div>
                  }
                  <div class="img-pick-body">
                    <div class="img-pick-actions">
                      <button type="button" class="btn btn-sm" (click)="libraryOpen.set(true)">{{ e.imageUrl ? 'Change' : 'Choose image' }}</button>
                      @if (e.imageUrl) {
                        <button type="button" class="btn btn-sm" (click)="e.imageUrl = ''">Remove</button>
                      }
                    </div>
                  </div>
                </div>
              </div>
              <div class="f">
                <label for="qg-video">Video link <small>(optional)</small></label>
                <input id="qg-video" type="text" [(ngModel)]="e.videoUrl" placeholder="YouTube link, or a direct video file URL" />
                <div class="hint">A YouTube link plays inside the exam; any other link must point straight to a video file.</div>
              </div>
            </div>

            <div class="sec">Questions in this group ({{ e.questions.length }})</div>
            @if (e.questions.length < MIN) {
              <div class="hint" style="margin-bottom:0.6rem">Pick at least {{ MIN }} questions. They are shown in the order below.</div>
            }
            @for (q of e.questions; track q.code; let i = $index) {
              <div class="pick-row">
                <span class="key">{{ i + 1 }}</span>
                <span class="pick-text"><b>{{ q.code }}</b> {{ plain(q.prompt) }}</span>
                <span class="pick-acts">
                  <button type="button" class="opt-remove" [disabled]="e.locked || i === 0" (click)="move(e, i, -1)" aria-label="Move up">↑</button>
                  <button type="button" class="opt-remove" [disabled]="e.locked || i === e.questions.length - 1" (click)="move(e, i, 1)" aria-label="Move down">↓</button>
                  <button type="button" class="opt-remove" [disabled]="e.locked" (click)="removeQuestion(e, i)" aria-label="Remove question">✕</button>
                </span>
              </div>
            }

            @if (!e.locked) {
              <div class="sec">Add questions</div>
              @if (!e.competitionCode || !e.category) {
                <div class="hint">Choose the competition and category first. Only questions from that competition and category that are not already in a group are listed.</div>
              } @else {
                <input class="search" style="max-width:none;width:100%" placeholder="Search the question text or code" [ngModel]="pickSearch()" (ngModelChange)="pickSearch.set($event); loadCandidates()" />
                <div class="cand-list">
                  @for (c of availableCandidates(); track c.code) {
                    <button type="button" class="cand" (click)="addQuestion(e, c)">
                      <b>{{ c.code }}</b> <span>{{ plain(c.prompt) }}</span> <i>+ Add</i>
                    </button>
                  } @empty {
                    <div class="empty" style="padding:1rem">{{ candidatesLoading() ? 'Loading…' : 'No more questions available for this competition and category.' }}</div>
                  }
                </div>
              }
            }

            <div class="f" style="margin-top:1rem">
              <label class="chk">
                <input type="checkbox" [(ngModel)]="e.active" [disabled]="e.questions.length < MIN || (e.locked && !!e.code)" />
                Active — include this group when students' exams are drawn
              </label>
              @if (e.questions.length < MIN) {
                <div class="hint">A group needs at least {{ MIN }} questions before it can be active.</div>
              }
              @if (e.locked && e.code) {
                <div class="hint">Switching a group on or off is paused while a live exam is running, because it would change what students who start now are served.</div>
              }
            </div>

            <div class="sec">Preview <small>(what a student sees above each question)</small></div>
            @if (e.title.trim()) {
              <div class="preview">
                <app-question-group-header
                  [group]="{ title: e.title, description: e.description, imageUrl: e.imageUrl, videoUrl: e.videoUrl }"
                  [part]="e.questions.length ? { n: 1, of: e.questions.length } : null"
                  [collapsed]="previewCollapsed()"
                  (toggled)="previewCollapsed.set(!previewCollapsed())"
                />
                @if (e.questions[0]; as first) {
                  <div class="prev-q">{{ plain(first.prompt) }}</div>
                }
              </div>
            } @else {
              <div class="hint">Add a title to see the preview.</div>
            }
          </div>
          <div class="m-foot">
            <button class="btn" (click)="close()">Cancel</button>
            <button class="btn btn-gold" [disabled]="busy()" (click)="save()">{{ busy() ? 'Saving…' : 'Save group' }}</button>
          </div>
        </div>
      </div>
    }

    @if (libraryOpen()) {
      <app-media-library-modal folder="q" (selected)="onImage($event)" (close)="libraryOpen.set(false)" />
    }

    @if (toast()) {
      <div class="toast">{{ toast() }}</div>
    }
  `,
  styles: [
    ADMIN_UI_CSS,
    `
      .intro { color: var(--muted, #9fb0d0); font-size: 0.9rem; max-width: 80ch; margin: 0 0 1rem; }
      td small.warn { color: #fda4af; display: inline; margin-left: 0.4rem; }
      .lock-note { background: rgba(232, 182, 74, 0.12); border: 1px solid rgba(232, 182, 74, 0.4); color: var(--gold-2, #f5cc5a); padding: 0.6rem 0.85rem; border-radius: 10px; font-size: 0.85rem; margin-bottom: 1rem; }
      .f small { font-weight: 500; color: var(--faint, #6e7f9e); }
      .sec small { text-transform: none; letter-spacing: 0; font-weight: 500; }
      .chk { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; color: var(--text, #eef2fb) !important; font-weight: 600 !important; cursor: pointer; }
      .chk input { width: auto; accent-color: var(--gold, #e8b64a); }
      .pick-row { display: flex; align-items: center; gap: 0.6rem; padding: 0.5rem 0.6rem; margin-bottom: 0.4rem; border: 1px solid var(--line, rgba(255,255,255,0.09)); border-radius: 10px; background: rgba(0,0,0,0.18); }
      .pick-row .key { width: 24px; height: 24px; flex: 0 0 auto; display: grid; place-items: center; border-radius: 7px; background: rgba(255,255,255,0.07); font-weight: 800; font-size: 0.74rem; }
      .pick-text { flex: 1; min-width: 0; font-size: 0.86rem; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
      .pick-acts { display: flex; gap: 0.3rem; flex: 0 0 auto; }
      .cand-list { max-height: 240px; overflow-y: auto; margin-top: 0.5rem; border: 1px solid var(--line, rgba(255,255,255,0.09)); border-radius: 10px; }
      .cand { display: flex; align-items: baseline; gap: 0.6rem; width: 100%; text-align: left; padding: 0.55rem 0.8rem; border: 0; border-bottom: 1px solid var(--line, rgba(255,255,255,0.06)); background: none; color: var(--text, #eef2fb); font-size: 0.85rem; cursor: pointer; }
      .cand:last-child { border-bottom: 0; }
      .cand:hover { background: rgba(232, 182, 74, 0.1); }
      .cand span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .cand i { font-style: normal; color: var(--gold-2, #f5cc5a); font-weight: 700; font-size: 0.78rem; flex: 0 0 auto; }
      .preview { border: 1px dashed var(--line-2, rgba(255,255,255,0.16)); border-radius: 12px; padding: 0.4rem 0.9rem 0.9rem; }
      .prev-q { margin-top: 0.8rem; font-size: 1.05rem; font-weight: 600; line-height: 1.45; }
    `,
  ],
})
export class AdminQuestionGroupsPage implements OnInit {
  private readonly api = inject(QuestionGroupsApi);

  protected readonly Math = Math;
  protected readonly MIN = MIN_QUESTIONS;
  protected readonly limit = 20;
  protected readonly plain = plainText;

  protected readonly rows = signal<QuestionGroupRow[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly toast = signal('');

  protected readonly search = signal('');
  protected readonly compFilter = signal('');
  protected readonly catFilter = signal('');
  protected readonly statusFilter = signal('');

  protected readonly competitions = signal<{ code: string; title: string; status: string }[]>([]);
  protected readonly categories = signal<string[]>([]);

  protected readonly editor = signal<Editor | null>(null);
  protected readonly modalError = signal('');
  protected readonly busy = signal(false);
  protected readonly libraryOpen = signal(false);
  protected readonly previewCollapsed = signal(false);

  protected readonly candidates = signal<GroupCandidate[]>([]);
  protected readonly candidatesLoading = signal(false);
  protected readonly pickSearch = signal('');

  ngOnInit(): void {
    this.api.competitions().subscribe({ next: (r) => this.competitions.set(r.data) });
    this.api.categories().subscribe({ next: (r) => this.categories.set(r.data.filter((c) => c.active).map((c) => c.name)) });
    this.reload();
  }

  protected reload(): void {
    this.page.set(1);
    this.load();
  }

  protected go(p: number): void {
    this.page.set(p);
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api
      .list({ search: this.search(), comp: this.compFilter(), category: this.catFilter(), status: this.statusFilter() }, this.page(), this.limit)
      .subscribe({
        next: (r) => {
          this.rows.set(r.data);
          this.total.set(r.total);
          this.loading.set(false);
        },
        error: (e) => {
          this.error.set(errText(e));
          this.loading.set(false);
        },
      });
  }

  private flash(msg: string): void {
    this.toast.set(msg);
    setTimeout(() => this.toast() === msg && this.toast.set(''), 2800);
  }

  // ---- editor
  protected openNew(): void {
    this.modalError.set('');
    this.pickSearch.set('');
    this.candidates.set([]);
    this.previewCollapsed.set(false);
    this.editor.set({
      code: null,
      title: '',
      description: '',
      imageUrl: '',
      videoUrl: '',
      competitionCode: this.compFilter(),
      category: this.catFilter(),
      active: false,
      questions: [],
      locked: false,
    });
    this.loadCandidates();
  }

  protected openEdit(row: QuestionGroupRow): void {
    this.modalError.set('');
    this.pickSearch.set('');
    this.candidates.set([]);
    this.previewCollapsed.set(false);
    this.api.get(row.code).subscribe({
      next: (g) => {
        this.editor.set({
          code: g.code,
          title: g.title,
          description: g.description ?? '',
          imageUrl: g.imageUrl ?? '',
          videoUrl: g.videoUrl ?? '',
          competitionCode: g.competitionCode ?? '',
          category: g.category,
          active: g.active,
          questions: g.questions.map((q) => ({ code: q.code, prompt: q.prompt })),
          locked: g.membershipLocked,
        });
        this.loadCandidates();
      },
      error: (e) => this.error.set(errText(e)),
    });
  }

  protected close(): void {
    this.editor.set(null);
    this.libraryOpen.set(false);
  }

  protected identityChanged(): void {
    this.loadCandidates();
  }

  protected loadCandidates(): void {
    const e = this.editor();
    if (!e || !e.competitionCode || !e.category || e.locked) {
      this.candidates.set([]);
      return;
    }
    this.candidatesLoading.set(true);
    this.api.candidates({ comp: e.competitionCode, category: e.category, search: this.pickSearch(), group: e.code ?? undefined }).subscribe({
      next: (c) => {
        this.candidates.set(c);
        this.candidatesLoading.set(false);
      },
      error: (err) => {
        this.candidatesLoading.set(false);
        this.modalError.set(errText(err));
      },
    });
  }

  /** Active categories, plus the group's own if it has since been switched off. */
  protected categoryOptions(current: string): string[] {
    const list = this.categories();
    return current && !list.includes(current) ? [...list, current] : list;
  }

  /** Candidates not already picked into this group. */
  protected availableCandidates(): GroupCandidate[] {
    const picked = new Set((this.editor()?.questions ?? []).map((q) => q.code));
    return this.candidates().filter((c) => !picked.has(c.code));
  }

  protected addQuestion(e: Editor, c: GroupCandidate): void {
    if (e.questions.length >= 12) {
      this.modalError.set('A group can have at most 12 questions.');
      return;
    }
    e.questions = [...e.questions, { code: c.code, prompt: c.prompt }];
    if (e.questions.length >= MIN_QUESTIONS && !e.code) e.active = true;
  }

  protected removeQuestion(e: Editor, i: number): void {
    e.questions = e.questions.filter((_, idx) => idx !== i);
    if (e.questions.length < MIN_QUESTIONS) e.active = false;
  }

  protected move(e: Editor, i: number, dir: -1 | 1): void {
    const next = e.questions.slice();
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    e.questions = next;
  }

  protected onImage(url: string): void {
    const e = this.editor();
    if (e) e.imageUrl = url;
    this.libraryOpen.set(false);
  }

  protected save(): void {
    const e = this.editor();
    if (!e) return;
    if (e.title.trim().length < 3) return this.modalError.set('Give the group a title (at least 3 characters).');
    if (!e.competitionCode || !e.category) return this.modalError.set('Choose a competition and a category.');
    if (e.active && e.questions.length < MIN_QUESTIONS) return this.modalError.set(`Pick at least ${MIN_QUESTIONS} questions before making the group active.`);

    this.busy.set(true);
    this.modalError.set('');
    const base = {
      title: e.title.trim(),
      description: e.description,
      imageUrl: e.imageUrl,
      videoUrl: e.videoUrl,
      active: e.active,
    };
    const req = e.code
      ? this.api.update(e.code, e.locked ? base : { ...base, competitionCode: e.competitionCode, category: e.category, questionCodes: e.questions.map((q) => q.code) })
      : this.api.create({ ...base, competitionCode: e.competitionCode, category: e.category, questionCodes: e.questions.map((q) => q.code) });
    req.subscribe({
      next: () => {
        this.busy.set(false);
        const wasNew = !e.code;
        this.close();
        this.flash(wasNew ? 'Group created' : 'Group saved');
        this.load();
      },
      error: (err) => {
        this.busy.set(false);
        this.modalError.set(errText(err));
      },
    });
  }

  protected remove(g: QuestionGroupRow): void {
    const note = g.questionCount ? ` Its ${g.questionCount} question(s) stay in the Question Bank and become ordinary questions again.` : '';
    if (!confirm(`Delete group "${g.title}"?${note}`)) return;
    this.api.remove(g.code).subscribe({
      next: () => {
        this.flash('Group deleted');
        this.load();
      },
      error: (e) => this.error.set(errText(e)),
    });
  }
}
