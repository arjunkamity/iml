import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '@core/services/api.service';
import { ADMIN_UI_CSS } from './admin-ui';
import { MediaLibraryModal } from './media-library-modal';

interface CompRow {
  code: string;
  title: string;
  grades: string;
  startDate: string;
  endDate: string;
  status: string;
  isMulti: boolean;
  registrations: number;
  stages: number;
}

interface ListResult {
  data: CompRow[];
  total: number;
  page: number;
  limit: number;
}

interface CompForm {
  title: string;
  grades: string;
  status: string;
  startDate: string;
  endDate: string;
  isMulti: boolean;
  description: string;
  photoUrl: string;
  scoringMode: string;
  certificateMode: string;
}

interface CompDetail extends CompRow {
  description: string | null;
  photoUrl: string | null;
  scoringMode: string;
  certificateMode: string;
}

interface Stage {
  id: number;
  position: number;
  name: string;
  mode: string;
  passMark: number;
  isFree: boolean;
  price: number;
  description: string | null;
  maxQualifiers: number | null;
}

interface Qualifier {
  status: string;
  score: number | null;
  qualified: boolean | null;
  unlockedAt: string | null;
  paidAt: string | null;
  stage: { position: number; name: string };
  registration: {
    code: string;
    status: string;
    student: { name: string; code: string; grade: string; school?: { name?: string } | null };
  };
}

interface GradeRow {
  name: string;
}

// GET /competitions/:code/question-mix — see CompetitionService.getQuestionMix.
interface MixInfo {
  competitionCode: string;
  rules: { category: string; count: number; available: number; inGroups?: number }[];
  pool: { category: string; available: number; inGroups?: number; withheld?: number }[];
  categories: string[];
  totalPerStudent: number;
  examLive: boolean;
  attempts: number;
}

function errText(err: unknown): string {
  const e = err as { error?: { message?: string }; message?: string };
  return e?.error?.message ?? e?.message ?? 'Something went wrong';
}

@Component({
  selector: 'app-admin-competitions',
  standalone: true,
  imports: [FormsModule, MediaLibraryModal, RouterLink],
  template: `
    @if (mgr) {
      <!-- competition detail -->
      <div class="bar">
        <button class="btn btn-sm" (click)="closeDetail()">&#8592; Back to competitions</button>
        <div class="grow"></div>
        <span class="bdg grey">{{ mgr.code }}</span>
        <span class="bdg" [class]="'bdg ' + statusBadge(mgr.status)">{{ mgr.status }}</span>
      </div>

      <div class="grid g4" style="margin-bottom:1rem">
        <div class="card">
          <div style="font-weight:800;font-size:1.02rem">{{ mgr.title }}</div>
          <small style="display:block;color:var(--muted, #9fb0d0)">Grades {{ mgr.grades || '—' }} &middot; {{ mgr.isMulti ? 'Multi-stage' : 'Single stage' }}</small>
          <div style="margin-top:0.6rem"><span class="bdg blue">{{ mgr.registrations }} registered</span> <span class="bdg gold">{{ mgr.stages }} stages</span></div>
        </div>
        <div class="card stat"><b>{{ slice(mgr.startDate) }}</b><small>Start date</small></div>
        <div class="card stat"><b>{{ slice(mgr.endDate) }}</b><small>End date</small></div>
        <div class="card stat"><b>{{ mgr.registrations }}</b><small>Registrations</small></div>
      </div>

      <div class="tabs">
        <button class="tab" [class.on]="mgrTab === 'stages'" (click)="mgrTab = 'stages'">Stages ({{ stages().length }})</button>
        <button class="tab" [class.on]="mgrTab === 'qual'" (click)="mgrTab = 'qual'; loadQual()">Qualifiers</button>
        <button class="tab" [class.on]="mgrTab === 'mix'" (click)="mgrTab = 'mix'; loadMix()">Question mix</button>
      </div>

      @if (mgrTab === 'stages') {
        <div class="bar">
          <span style="font-size:0.82rem;color:var(--muted, #9fb0d0)">Stages in order; add/edit to shape the journey.</span>
          <div class="grow"></div>
          <button class="btn btn-gold btn-sm" (click)="openStage()">+ Stage</button>
        </div>

        @if (stageFormOpen) {
          <div class="card" style="margin-bottom:1rem;max-width:720px">
            <div style="font-weight:800;font-size:1.02rem;margin-bottom:0.9rem">{{ editingStage ? 'Edit stage' : 'Add stage' }}</div>
            @if (stageErr) {
              <div class="err">{{ stageErr }}</div>
            }
            <div class="grid g2" style="margin-bottom:0.8rem">
              <div class="f"><label>Position</label><input type="number" [(ngModel)]="sf.position" /></div>
              <div class="f"><label>Pass mark %</label><input type="number" step="0.1" [(ngModel)]="sf.passMark" /></div>
            </div>
            <div class="f"><label>Name</label><input [(ngModel)]="sf.name" /></div>
            <div class="f">
              <label>Mode</label>
              <select [(ngModel)]="sf.mode">
                <option value="Online">Online</option>
                <option value="Offline">Offline</option>
                <option value="Hybrid">Hybrid</option>
                <option value="Peer Interview">Peer Interview</option>
              </select>
            </div>
            <div class="mods" style="margin-bottom:0.9rem">
              <label class="chk"><input type="checkbox" [(ngModel)]="sf.isFree" /> Free stage</label>
            </div>
            <div class="f"><label>Price (paid stage)</label><input type="number" step="0.01" [(ngModel)]="sf.price" /></div>
            <div class="f">
              <label>Max qualifiers for next stage</label>
              <input type="number" min="1" placeholder="Leave blank — no cap" [(ngModel)]="sf.maxQualifiers" />
              <small style="color:var(--muted,#9fb0d0)">
                Leave blank and every attempt clearing the pass mark advances right away, same as today. Set a number
                and advancing is decided by a ranked selection you run from here once the stage closes (fastest
                eligible attempts first).
              </small>
            </div>
            <div class="f"><label>Description</label><textarea [(ngModel)]="sf.description" rows="3"></textarea></div>
            <div class="bar" style="margin:0.6rem 0 0">
              <button class="btn" (click)="stageFormOpen = false">Cancel</button>
              <button class="btn btn-gold" (click)="saveStage()">{{ editingStage ? 'Save' : 'Add' }}</button>
            </div>
          </div>
        }

        <div class="tbl-wrap">
          <table>
            <thead><tr><th>Pos</th><th>Stage</th><th>Mode</th><th>Pass</th><th>Free</th><th>Price</th><th>Max qualifiers</th><th></th></tr></thead>
            <tbody>
              @for (s of stages(); track s.id) {
                <tr>
                  <td data-label="Pos">{{ s.position }}</td>
                  <td data-label="Stage"><span class="b">{{ s.name }}</span></td>
                  <td data-label="Mode">{{ s.mode }}</td>
                  <td data-label="Pass">{{ s.passMark }}%</td>
                  <td data-label="Free">{{ s.isFree ? 'Yes' : 'No' }}</td>
                  <td data-label="Price">{{ s.price }}</td>
                  <td data-label="Max qualifiers">{{ s.maxQualifiers ?? 'No cap' }}</td>
                  <td>
                    <div class="acts">
                      <button class="btn btn-sm" (click)="openStage(s)">Edit</button>
                      @if (s.maxQualifiers) {
                        <a class="btn btn-sm btn-gold" routerLink="/admin/selection">Run Selection</a>
                      }
                      <button class="btn btn-sm btn-danger" (click)="removeStage(s)">Delete</button>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="8" class="empty">No stages yet.</td></tr>
              }
            </tbody>
          </table>
        </div>
      }


      @if (mgrTab === 'mix') {
        <div class="card" style="margin-bottom:1rem">
          <p style="margin:0;font-size:0.88rem;color:var(--muted,#9fb0d0)">
            Choose which question categories this competition's exam serves and how many from each, per student.
            Questions are drawn at random within each category, so every student gets the same balance. With no rows,
            every question tagged to this competition is used (the original behaviour), capped by the exam's own question count.
          </p>
        </div>

        @if (mixInfo(); as m) {
          @if (m.examLive || m.attempts > 0) {
            <div class="err" style="background:rgba(232,182,74,0.12);border-color:rgba(232,182,74,0.45);color:#f5cc5a">
              {{ m.examLive ? 'An exam for this competition is Live. ' : '' }}{{ m.attempts }} attempt{{ m.attempts === 1 ? '' : 's' }} already exist.
              Changes apply to <b>new attempts only</b> — attempts in progress keep the questions they were given.
            </div>
          }
        }
        @if (mixErr()) {
          <div class="err">{{ mixErr() }}</div>
        }
        @if (mixMsg()) {
          <div class="bdg green" style="display:inline-block;margin-bottom:0.8rem">{{ mixMsg() }}</div>
        }

        <div class="tbl-wrap">
          <table>
            <thead><tr><th>Category</th><th>Questions per student</th><th>Available in pool</th><th>Status</th><th></th></tr></thead>
            <tbody>
              @for (r of mixDraft(); track $index) {
                <tr>
                  <td data-label="Category">
                    <select [ngModel]="r.category" (ngModelChange)="setMixCategory($index, $event)">
                      <option value="" disabled>Choose a category</option>
                      @for (c of mixCategoryOptions($index); track c) {
                        <option [value]="c">{{ c }}</option>
                      }
                    </select>
                  </td>
                  <td data-label="Questions per student">
                    <input type="number" min="1" max="500" style="max-width:110px" [ngModel]="r.count" (ngModelChange)="setMixCount($index, $event)" />
                  </td>
                  <td data-label="Available in pool">
                    {{ mixAvailable(r.category) }}
                    @if (mixInGroups(r.category)) {
                      <small class="muted-note">incl. {{ mixInGroups(r.category) }} in groups</small>
                    }
                  </td>
                  <td data-label="Status">
                    @if (!r.category) {
                      <span class="bdg grey">—</span>
                    } @else if (mixAvailable(r.category) === 0) {
                      <span class="bdg red">No questions tagged</span>
                    } @else if (r.count > mixAvailable(r.category)) {
                      <span class="bdg red">Short by {{ r.count - mixAvailable(r.category) }}</span>
                    } @else {
                      <span class="bdg green">OK</span>
                    }
                  </td>
                  <td>
                    <div class="acts"><button class="btn btn-sm btn-danger" (click)="removeMixRow($index)">Remove</button></div>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="5" class="empty">No mix set — every tagged question is used.</td></tr>
              }
            </tbody>
          </table>
        </div>

        @if (mixWithheld().length) {
          <p style="margin:0.8rem 0 0;font-size:0.84rem;color:var(--muted,#9fb0d0)">
            Not served because their question group is inactive or has fewer than 2 questions:
            @for (p of mixWithheld(); track p.category) {
              <span class="bdg gold" style="margin-left:0.3rem">{{ p.category }} · {{ p.withheld }}</span>
            }
          </p>
        }

        @if (mixUnused().length) {
          <p style="margin:0.8rem 0 0;font-size:0.84rem;color:var(--muted,#9fb0d0)">
            In this competition's pool but not served by the mix:
            @for (p of mixUnused(); track p.category) {
              <span class="bdg grey" style="margin-left:0.3rem">{{ p.category }} · {{ p.available }}</span>
            }
          </p>
        }

        <div class="bar" style="margin-top:1rem">
          <button class="btn" [disabled]="!mixCanAdd()" (click)="addMixRow()">+ Add category</button>
          <span style="font-weight:700">{{ mixTotal() }} question{{ mixTotal() === 1 ? '' : 's' }} per student</span>
          <div class="grow"></div>
          <button class="btn" [disabled]="!mixDirty() || mixBusy()" (click)="loadMix()">Discard changes</button>
          <button class="btn btn-gold" [disabled]="!mixDirty() || mixBusy()" (click)="saveMix()">{{ mixBusy() ? 'Saving…' : 'Save mix' }}</button>
        </div>
      }

      @if (mgrTab === 'qual') {
        <div class="bar">
          <select class="filter" [(ngModel)]="qualStage" (ngModelChange)="loadQual()">
            <option [ngValue]="null">All stages</option>
            @for (s of stages(); track s.id) {
              <option [ngValue]="s.position">Stage {{ s.position }} — {{ s.name }}</option>
            }
          </select>
          <div class="grow"></div>
          <span style="font-size:0.82rem;color:var(--muted, #9fb0d0)">{{ quals().length }} rows</span>
        </div>
        <div class="tbl-wrap">
          <table>
            <thead><tr><th>Student</th><th>Stage</th><th>Score</th><th>Qualified</th><th>Status</th></tr></thead>
            <tbody>
              @for (q of quals(); track $index) {
                <tr>
                  <td data-label="Student"><span class="b">{{ q.registration.student.name }}</span><small>{{ q.registration.student.grade }}</small></td>
                  <td data-label="Stage">St{{ q.stage.position }} — {{ q.stage.name }}</td>
                  <td data-label="Score">{{ q.score ?? '—' }}</td>
                  <td data-label="Qualified">
                    @if (q.qualified === true) { <span class="bdg green">Yes</span> }
                    @else if (q.qualified === false) { <span class="bdg red">No</span> }
                    @else { <span class="bdg grey">—</span> }
                  </td>
                  <td data-label="Status"><span class="bdg" [class]="'bdg ' + qualBadge(q.status)">{{ q.status }}</span></td>
                </tr>
              } @empty {
                <tr><td colspan="5" class="empty">No qualifier rows yet.</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    } @else if (formOpen) {
      <!-- create / edit competition -->
      <div class="bar">
        <button class="btn btn-sm" (click)="formOpen = false">&#8592; Back to competitions</button>
      </div>
      <div class="card" style="max-width:720px">
        <div style="font-weight:800;font-size:1.05rem;margin-bottom:0.9rem">{{ editing ? 'Edit competition' : 'New competition' }}</div>
        @if (modalError) {
          <div class="err">{{ modalError }}</div>
        }
        <div class="f">
          <label>Title</label>
          <input [(ngModel)]="form.title" />
        </div>
        <div class="grid g2" style="margin-bottom:0.8rem">
          <div class="f">
            <label>Grades</label>
            <select [(ngModel)]="form.grades">
              <option value="">—</option>
              @for (g of gradeOptions(); track g) {
                <option [value]="g">{{ g }}</option>
              }
            </select>
          </div>
          <div class="f">
            <label>Status</label>
            <select [(ngModel)]="form.status">
              <option value="Draft">Draft</option>
              <option value="Open">Open</option>
              <option value="Live">Live</option>
              <option value="Closed">Closed</option>
            </select>
          </div>
        </div>
        <div class="grid g2" style="margin-bottom:0.8rem">
          <div class="f"><label>Start date</label><input type="date" [(ngModel)]="form.startDate" /></div>
          <div class="f"><label>End date</label><input type="date" [(ngModel)]="form.endDate" /></div>
        </div>
        <div class="mods" style="margin-bottom:0.9rem">
          <label class="chk"><input type="checkbox" [(ngModel)]="form.isMulti" /> Multi-stage competition</label>
        </div>
        <div class="grid g2" style="margin-bottom:0.8rem">
          <div class="f">
            <label>Result scoring</label>
            <select [(ngModel)]="form.scoringMode">
              <option value="PERCENT">% Percent only</option>
              <option value="GRADE">Grading (A+ – F)</option>
              <option value="FRACTION">Score / Total (e.g. 80/100)</option>
            </select>
            <small style="display:block;color:var(--muted, #9fb0d0);margin-top:0.25rem">How a student sees their result — admin views always show the full raw score regardless.</small>
          </div>
          <div class="f">
            <label>Certificate issuance</label>
            <select [(ngModel)]="form.certificateMode">
              <option value="INSTANT">Instant — issued automatically on submit</option>
              <option value="MANUAL">Manual — admin issues each one from Results</option>
            </select>
            <small style="display:block;color:var(--muted, #9fb0d0);margin-top:0.25rem">Manual also disables the student's own "download certificate" button until an admin issues it.</small>
          </div>
        </div>
        <div class="f">
          <label>Description</label>
          <textarea [(ngModel)]="form.description" rows="3"></textarea>
        </div>
        <div class="f">
          <label>Photo</label>
          <div class="img-pick">
            @if (form.photoUrl) {
              <img [src]="form.photoUrl" alt="" class="img-pick-thumb" />
            } @else {
              <div class="img-pick-thumb empty-thumb">—</div>
            }
            <div class="img-pick-body">
              <span class="img-pick-name">{{ photoFileName(form.photoUrl) || 'Not set' }}</span>
              <div class="img-pick-actions">
                <button type="button" class="btn btn-sm" (click)="openLibrary()">Choose Image</button>
                @if (form.photoUrl) {
                  <button type="button" class="btn btn-sm btn-danger" (click)="form.photoUrl = ''">Clear</button>
                }
              </div>
            </div>
          </div>
        </div>
        <div class="bar" style="margin:0.6rem 0 0">
          <button class="btn" (click)="formOpen = false">Cancel</button>
          <button class="btn btn-gold" (click)="save()">{{ editing ? 'Save' : 'Create' }}</button>
        </div>
      </div>
    } @else {
      <!-- list -->
      <div class="bar">
        <select class="filter" [(ngModel)]="status" (ngModelChange)="go(1)">
          <option value="">All statuses</option>
          <option value="Draft">Draft</option>
          <option value="Open">Open</option>
          <option value="Live">Live</option>
          <option value="Closed">Closed</option>
          <!-- Not a real editable status (see the Edit form's own select,
               which deliberately omits it) — only reachable via the
               dedicated Archive action, and only viewable, not
               re-selectable, from here. -->
          <option value="Archived">Archived</option>
        </select>
        <input class="search" placeholder="Search title / code…" [(ngModel)]="search" (keyup.enter)="go(1)" />
        <div class="grow"></div>
        <button class="btn btn-gold" (click)="openCreate()">+ Competition</button>
      </div>

      @if (error) {
        <div class="err">{{ error }}</div>
      }

      <div class="tbl-wrap" (scroll)="closeMenu()">
        <table>
          <thead>
            <tr><th>Code</th><th>Title</th><th>Grades</th><th>Dates</th><th>Status</th><th>Stages</th><th>Regs</th><th></th></tr>
          </thead>
          <tbody>
            @for (c of rows(); track c.code) {
              <tr>
                <td data-label="Code">{{ c.code }}</td>
                <td data-label="Title"><span class="b">{{ c.title }}</span></td>
                <td data-label="Grades">{{ c.grades }}</td>
                <td data-label="Dates">{{ slice(c.startDate) }} → {{ slice(c.endDate) }}</td>
                <td data-label="Status"><span class="bdg" [class]="'bdg ' + statusBadge(c.status)">{{ c.status }}</span></td>
                <td data-label="Stages">{{ c.stages }}</td>
                <td data-label="Regs">{{ c.registrations }}</td>
                <td>
                  <div class="kebab-wrap">
                    <button class="btn btn-sm kebab-btn" title="Actions" (click)="$event.stopPropagation(); toggleMenu(c.code, $event)">&#8942;</button>
                    @if (openMenuFor() === c.code) {
                      <div class="kebab-menu" [style.position]="'fixed'" [style.top.px]="menuPos()?.top" [style.right.px]="menuPos()?.right" (click)="$event.stopPropagation()">
                        @if (c.status !== 'Archived') {
                          <button type="button" (click)="manage(c); closeMenu()">Stages &amp; qualifiers</button>
                          <button type="button" (click)="openEdit(c); closeMenu()">Edit</button>
                          <button type="button" (click)="archive(c); closeMenu()">Archive</button>
                        } @else {
                          <small>Archived — read-only. No unarchive action.</small>
                        }
                        <button type="button" class="danger" (click)="remove(c); closeMenu()">Delete</button>
                      </div>
                    }
                  </div>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="8" class="empty">No competitions yet.</td></tr>
            }
          </tbody>
        </table>
      </div>

      @if (total() > 0) {
        <div class="pager">
          <span>{{ ((page() - 1) * 10 + 1) }}–{{ min(page() * 10, total()) }} of {{ total() }}</span>
          <button class="btn btn-sm" [disabled]="page() <= 1" (click)="go(page() - 1)">← Prev</button>
          <button class="btn btn-sm" [disabled]="page() * 10 >= total()" (click)="go(page() + 1)">Next →</button>
        </div>
      }
    }

    @if (libraryOpen) {
      <app-media-library-modal
        folder="competitions"
        (selected)="onImageSelected($event)"
        (close)="libraryOpen = false"
      />
    }
  `,
  styles: [ADMIN_UI_CSS],
})
export class AdminCompetitionsPage {
  private readonly api = inject(ApiService);
  readonly rows = signal<CompRow[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly stages = signal<Stage[]>([]);
  readonly quals = signal<Qualifier[]>([]);
  readonly gradeOptions = signal<string[]>([]);
  search = '';
  status = '';

  // Row actions "3 dots" menu — see .kebab-* in ADMIN_UI_CSS. Positioned
  // via computed fixed coordinates, not the CSS's own position:absolute
  // default, so it renders above .tbl-wrap's overflow:auto instead of
  // being clipped by it — see toggleMenu().
  readonly openMenuFor = signal<string | null>(null);
  protected readonly menuPos = signal<{ top: number; right: number } | null>(null);

  @HostListener('document:click')
  protected closeMenu(): void {
    this.openMenuFor.set(null);
    this.menuPos.set(null);
  }

  protected toggleMenu(code: string, event: MouseEvent): void {
    if (this.openMenuFor() === code) {
      this.closeMenu();
      return;
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.menuPos.set({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    this.openMenuFor.set(code);
  }
  error = '';
  formOpen = false;
  editing = false;
  editingCode = '';
  modalError = '';
  mgr: CompRow | null = null;
  mgrTab: 'stages' | 'qual' | 'mix' = 'stages';

  // ---- Question mix tab (all signals — async results must re-render) ----
  readonly mixInfo = signal<MixInfo | null>(null);
  readonly mixDraft = signal<{ category: string; count: number }[]>([]);
  readonly mixDirty = signal(false);
  readonly mixBusy = signal(false);
  readonly mixErr = signal('');
  readonly mixMsg = signal('');
  readonly mixTotal = computed(() => this.mixDraft().reduce((n, r) => n + (Number(r.count) || 0), 0));
  readonly mixUnused = computed(() => {
    const used = new Set(this.mixDraft().map((r) => r.category));
    return (this.mixInfo()?.pool ?? []).filter((p) => !used.has(p.category));
  });
  readonly mixCanAdd = computed(() => {
    const used = new Set(this.mixDraft().map((r) => r.category));
    return (this.mixInfo()?.categories ?? []).some((c) => !used.has(c));
  });

  readonly mixWithheld = computed(() => (this.mixInfo()?.pool ?? []).filter((p) => (p.withheld ?? 0) > 0));

  /** Of a category's available questions, how many are served as part of a Question Group. */
  mixInGroups(category: string): number {
    return this.mixInfo()?.pool.find((p) => p.category === category)?.inGroups ?? 0;
  }

  mixAvailable(category: string): number {
    return this.mixInfo()?.pool.find((p) => p.category === category)?.available ?? 0;
  }

  /** Categories a row may pick: its own current one plus any not used elsewhere. */
  mixCategoryOptions(index: number): string[] {
    const usedElsewhere = new Set(this.mixDraft().filter((_, i) => i !== index).map((r) => r.category));
    return (this.mixInfo()?.categories ?? []).filter((c) => !usedElsewhere.has(c));
  }

  loadMix() {
    if (!this.mgr) return;
    this.mixErr.set('');
    this.mixMsg.set('');
    this.api.get<MixInfo>(`/competitions/${this.mgr.code}/question-mix`).subscribe({
      next: (r) => this.applyMix(r),
      error: (e) => this.mixErr.set(errText(e)),
    });
  }

  private applyMix(r: MixInfo) {
    this.mixInfo.set(r);
    this.mixDraft.set(r.rules.map((x) => ({ category: x.category, count: x.count })));
    this.mixDirty.set(false);
  }

  private editMix(fn: (rows: { category: string; count: number }[]) => { category: string; count: number }[]) {
    this.mixDraft.update((rows) => fn(rows.map((r) => ({ ...r }))));
    this.mixDirty.set(true);
    this.mixMsg.set('');
  }

  setMixCategory(i: number, category: string) {
    this.editMix((rows) => { rows[i].category = category; return rows; });
  }

  setMixCount(i: number, count: number | null) {
    this.editMix((rows) => { rows[i].count = Number(count) || 0; return rows; });
  }

  addMixRow() {
    const used = new Set(this.mixDraft().map((r) => r.category));
    const next = (this.mixInfo()?.categories ?? []).find((c) => !used.has(c)) ?? '';
    this.editMix((rows) => [...rows, { category: next, count: 10 }]);
  }

  removeMixRow(i: number) {
    this.editMix((rows) => rows.filter((_, idx) => idx !== i));
  }

  saveMix() {
    if (!this.mgr || this.mixBusy()) return;
    const rows = this.mixDraft();
    if (rows.some((r) => !r.category)) { this.mixErr.set('Choose a category for every row, or remove the empty row.'); return; }
    if (rows.some((r) => !Number.isInteger(r.count) || r.count < 1)) { this.mixErr.set('Each category needs a whole number of questions, at least 1.'); return; }
    this.mixBusy.set(true);
    this.mixErr.set('');
    this.api.put<MixInfo>(`/competitions/${this.mgr.code}/question-mix`, { rules: rows }).subscribe({
      next: (r) => {
        this.mixBusy.set(false);
        this.applyMix(r);
        this.mixMsg.set(rows.length ? 'Saved — applies to new attempts.' : 'Mix cleared — every tagged question is used again.');
      },
      error: (e) => { this.mixBusy.set(false); this.mixErr.set(errText(e)); },
    });
  }
  qualStage: number | null = null;
  stageFormOpen = false;
  editingStage = false;
  stageId: number | null = null;
  stageErr = '';
  form: CompForm = { title: '', grades: '', status: 'Draft', startDate: '', endDate: '', isMulti: false, description: '', photoUrl: '', scoringMode: 'PERCENT', certificateMode: 'INSTANT' };
  libraryOpen = false;

  constructor() {
    this.loadGrades();
    this.load();
  }

  loadGrades() {
    this.api.get<{ data: GradeRow[] }>('/grades', { limit: 100 }).subscribe({
      next: (r) => {
        const opts = (r.data ?? [])
          .map((g) => g.name)
          .filter(Boolean)
          .sort();
        this.gradeOptions.set(opts);
      },
      error: () => this.gradeOptions.set([]),
    });
  }

  min(a: number, b: number) {
    return Math.min(a, b);
  }

  slice(v: string) {
    return typeof v === 'string' ? v.slice(0, 10) : '';
  }

  statusBadge(s: string) {
    return { Draft: 'grey', Open: 'blue', Live: 'green', Closed: 'red', Archived: 'grey' }[s] ?? 'grey';
  }

  qualBadge(s: string) {
    return { Locked: 'grey', Paid: 'blue', Attempted: 'purple', Qualified: 'green', Eliminated: 'red' }[s] ?? 'grey';
  }

  load() {
    this.error = '';
    const p: Record<string, unknown> = { page: this.page(), limit: 10 };
    if (this.status) p['status'] = this.status;
    if (this.search.trim()) p['search'] = this.search.trim();
    this.api.get<ListResult>('/competitions', p).subscribe({
      next: (r) => {
        this.rows.set(r.data ?? []);
        this.total.set(r.total ?? 0);
      },
      error: (e) => {
        this.error = errText(e);
      },
    });
  }

  go(p: number) {
    this.page.set(p);
    this.load();
  }

  closeDetail() {
    this.mgr = null;
  }

  openCreate() {
    this.form = { title: '', grades: '', status: 'Draft', startDate: '', endDate: '', isMulti: false, description: '', photoUrl: '', scoringMode: 'PERCENT', certificateMode: 'INSTANT' };
    this.editing = false;
    this.editingCode = '';
    this.modalError = '';
    this.formOpen = true;
  }

  openEdit(c: CompRow) {
    this.form = {
      title: c.title,
      grades: c.grades,
      status: c.status,
      startDate: this.slice(c.startDate),
      endDate: this.slice(c.endDate),
      isMulti: c.isMulti,
      description: '',
      photoUrl: '',
      scoringMode: 'PERCENT',
      certificateMode: 'INSTANT',
    };
    this.editing = true;
    this.editingCode = c.code;
    this.modalError = '';
    this.formOpen = true;
    // The list row doesn't carry description/photo/scoring settings — fetch
    // the full record so editing doesn't silently blank/reset them on save.
    this.api.get<CompDetail>(`/competitions/${c.code}`).subscribe({
      next: (full) => {
        if (this.editingCode !== c.code) return; // form was reopened/closed meanwhile
        this.form.description = full.description ?? '';
        this.form.photoUrl = full.photoUrl ?? '';
        this.form.scoringMode = full.scoringMode ?? 'PERCENT';
        this.form.certificateMode = full.certificateMode ?? 'INSTANT';
      },
      error: () => {
        /* form still usable with blank description/photo; save() would just not change them */
      },
    });
  }

  openLibrary() {
    this.libraryOpen = true;
  }

  photoFileName(url: string): string {
    if (!url) return '';
    const clean = url.split('?')[0];
    return clean.split('/').pop() ?? clean;
  }

  onImageSelected(url: string) {
    this.form.photoUrl = url;
    this.libraryOpen = false;
  }

  save() {
    this.modalError = '';
    const body = {
      title: this.form['title'],
      grades: this.form['grades'],
      status: this.form['status'],
      startDate: this.form['startDate'],
      endDate: this.form['endDate'],
      isMulti: this.form['isMulti'],
      description: this.form['description'] || undefined,
      photoUrl: this.form['photoUrl'] || undefined,
      scoringMode: this.form['scoringMode'],
      certificateMode: this.form['certificateMode'],
    };
    const req = this.editing
      ? this.api.patch(`/competitions/${this.editingCode}`, body)
      : this.api.post('/competitions', body);
    req.subscribe({
      next: () => {
        this.formOpen = false;
        this.load();
      },
      error: (e) => {
        this.modalError = errText(e);
      },
    });
  }

  remove(c: CompRow) {
    if (!confirm(`Delete competition ${c.code} — ${c.title}? This also removes its stages, questions, prizes.`)) return;
    this.api.delete(`/competitions/${c.code}`).subscribe({
      next: () => this.load(),
      error: (e) => {
        this.error = errText(e);
      },
    });
  }

  /** Soft-remove — same one-way convention as Student.archived. Nothing
   * is deleted; the competition just drops out of the default list
   * (still reachable via the Archived status filter) and becomes
   * read-only here. There is deliberately no unarchive action. */
  archive(c: CompRow) {
    if (!confirm(`Archive competition ${c.code} — ${c.title}? It will be hidden from the default list and become read-only. This cannot be undone from here.`)) return;
    this.api.patch(`/competitions/${c.code}`, { status: 'Archived' }).subscribe({
      next: () => this.load(),
      error: (e) => {
        this.error = errText(e);
      },
    });
  }

  manage(c: CompRow) {
    this.mgr = c;
    this.mgrTab = 'stages';
    this.qualStage = null;
    this.stageFormOpen = false;
    this.mixInfo.set(null);
    this.mixDraft.set([]);
    this.mixDirty.set(false);
    this.mixErr.set('');
    this.mixMsg.set('');
    this.loadStages();
  }

  loadStages() {
    if (!this.mgr) return;
    this.api.get<Stage[]>(`/competitions/${this.mgr.code}/stages`).subscribe({
      next: (r) => this.stages.set(Array.isArray(r) ? r : []),
      error: () => this.stages.set([]),
    });
  }

  loadQual() {
    if (!this.mgr) return;
    const p: Record<string, unknown> = {};
    if (this.qualStage != null) p['stage'] = this.qualStage;
    this.api.get<Qualifier[]>(`/competitions/${this.mgr.code}/qualifiers`, p).subscribe({
      next: (r) => this.quals.set(Array.isArray(r) ? r : []),
      error: () => this.quals.set([]),
    });
  }

  sf: {
    position: number;
    name: string;
    mode: string;
    passMark: number;
    isFree: boolean;
    price: number;
    description: string;
    maxQualifiers: number | null;
  } = {
    position: 1,
    name: '',
    mode: 'Online',
    passMark: 40,
    isFree: true,
    price: 0,
    description: '',
    maxQualifiers: null,
  };

  openStage(s?: Stage) {
    this.stageErr = '';
    if (s) {
      this.editingStage = true;
      this.stageId = s.id;
      this.sf = {
        position: s.position,
        name: s.name,
        mode: s.mode,
        passMark: Number(s.passMark),
        isFree: s.isFree,
        price: Number(s.price),
        description: s.description ?? '',
        maxQualifiers: s.maxQualifiers,
      };
    } else {
      this.editingStage = false;
      this.stageId = null;
      const nextPos = this.stages().length ? Math.max(...this.stages().map((x) => x.position)) + 1 : 1;
      this.sf = { position: nextPos, name: '', mode: 'Online', passMark: 40, isFree: true, price: 0, description: '', maxQualifiers: null };
    }
    this.stageFormOpen = true;
  }

  saveStage() {
    if (!this.mgr) return;
    this.stageErr = '';
    const body = {
      position: Number(this.sf.position),
      name: this.sf.name,
      mode: this.sf.mode,
      passMark: Number(this.sf.passMark),
      isFree: this.sf.isFree,
      price: Number(this.sf.price),
      description: this.sf.description || undefined,
      maxQualifiers: this.sf.maxQualifiers ? Number(this.sf.maxQualifiers) : null,
    };
    const req = this.editingStage
      ? this.api.patch(`/competitions/${this.mgr.code}/stages/${this.stageId}`, body)
      : this.api.post(`/competitions/${this.mgr.code}/stages`, body);
    req.subscribe({
      next: () => {
        this.stageFormOpen = false;
        this.loadStages();
      },
      error: (e) => {
        this.stageErr = errText(e);
      },
    });
  }

  removeStage(s: Stage) {
    if (!this.mgr) return;
    if (!confirm(`Delete stage ${s.position} — ${s.name}? This also removes its rules, attempts and payments.`)) return;
    this.api.delete(`/competitions/${this.mgr.code}/stages/${s.id}`).subscribe({
      next: () => this.loadStages(),
      error: (e) => {
        this.error = errText(e);
      },
    });
  }

}
