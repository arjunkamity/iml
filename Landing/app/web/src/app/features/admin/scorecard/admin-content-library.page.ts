import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ADMIN_UI_CSS } from '../admin-ui';
import {
  ContentMeta,
  CoverageCell,
  CoverageKind,
  CoverageResponse,
  FrameworkConfig,
  FrameworkRow,
  ImportResult,
  LibraryRow,
  ScorecardAdminApi,
  TemplatePreview,
  TextKindInfo,
  TextRow,
  TextState,
  TextVersionRow,
  errText,
} from './scorecard-admin.service';

type Tab = 'wording' | 'coverage' | 'settings';

interface TextEditor {
  id: number | null;
  kind: string;
  key: string;
  levelKey: string;
  language: string;
  position: number;
  title: string;
  text: string;
  state: TextState | 'new';
  approvedVersion: number | null;
  approvedText: string | null;
}

const STATE_LABEL: Record<TextState, string> = { draft: 'Draft', approved: 'Approved', changed: 'Edited since approval', withdrawn: 'Approval withdrawn' };

@Component({
  selector: 'app-admin-content-library',
  standalone: true,
  imports: [FormsModule, DatePipe, RouterLink],
  template: `
    <a class="back" [routerLink]="code() ? '/admin/scorecard/content' : '/admin/scorecard'">← {{ code() ? 'Content libraries' : 'Scorecard setup' }}</a>

    @if (error()) {
      <div class="err">{{ error() }}</div>
    }

    @if (!code()) {
      <!-- ============================================================ libraries -->
      <p class="intro">
        The wording the scorecard report uses — strengths, growth text, the 30-day challenge, reflection questions, the disclaimer — is kept here, not in code.
        Each piece has a <b>draft</b> you edit and an <b>approved</b> version the reports read; approving never changes an earlier version, so any issued report can be traced to its exact words.
      </p>
      <div class="bar">
        <h3 style="margin:0">Content libraries</h3>
        <div class="grow"></div>
        <button class="btn btn-gold" (click)="openNew()">+ New library</button>
      </div>
      @if (loading()) {
        <div class="empty">Loading…</div>
      } @else if (!libraries().length) {
        <div class="card empty">No libraries yet. Create one, or ask a developer to run the sample wording seed to start from the client's report.</div>
      } @else {
        <div class="tbl-wrap">
          <table>
            <thead><tr><th>Library</th><th>Wording</th><th>Languages</th><th>Used by seasons</th><th>Updated</th><th></th></tr></thead>
            <tbody>
              @for (l of libraries(); track l.code) {
                <tr>
                  <td data-label="Library"><a class="b link" [routerLink]="['/admin/scorecard/content', l.code]">{{ l.name }}</a><small>{{ l.code }}</small></td>
                  <td data-label="Wording">
                    {{ l.counts.total }} pieces
                    <small>{{ l.counts.approved }} approved · {{ l.counts.changed }} edited · {{ l.counts.draft }} draft</small>
                  </td>
                  <td data-label="Languages">{{ l.languages.join(', ') }}</td>
                  <td data-label="Seasons">{{ l.seasons.length ? seasonNames(l) : '—' }}</td>
                  <td data-label="Updated">{{ l.updatedAt | date: 'd MMM y' }}</td>
                  <td><div class="acts"><a class="btn btn-sm" [routerLink]="['/admin/scorecard/content', l.code]">Open</a></div></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    } @else if (lib(); as l) {
      <!-- ============================================================ one library -->
      <div class="head">
        <div class="titles">
          <span class="codeline">{{ l.code }} · {{ l.languages.join(', ') }}</span>
          <h2>{{ l.name }}</h2>
          <small class="codeline">
            {{ l.counts.total }} pieces · {{ l.counts.approved }} approved · {{ l.counts.changed }} edited since approval · {{ l.counts.draft }} not approved
            @if (l.seasons.length) { · used by {{ seasonNames(l) }} }
          </small>
        </div>
        <div class="actions">
          <button class="btn" (click)="exportCsv()">Export CSV</button>
          <label class="btn file-btn">Import CSV<input type="file" accept=".csv,text/csv" (change)="onFile($event)" /></label>
          <button class="btn btn-gold" (click)="openNewText(null)">+ Add wording</button>
        </div>
      </div>

      <div class="tabs" role="tablist">
        <button class="tab" role="tab" [class.on]="tab() === 'wording'" (click)="tab.set('wording')">Wording</button>
        <button class="tab" role="tab" [class.on]="tab() === 'coverage'" (click)="openCoverage()">Coverage</button>
        <button class="tab" role="tab" [class.on]="tab() === 'settings'" (click)="openSettings()">Settings</button>
      </div>

      @switch (tab()) {
        @case ('wording') {
          <div class="bar filters">
            <select aria-label="Kind" [ngModel]="kindFilter()" (ngModelChange)="kindFilter.set($event)">
              <option value="">All kinds</option>
              @for (k of kinds(); track k.key) { <option [value]="k.key">{{ k.label }}</option> }
            </select>
            @if (l.languages.length > 1) {
              <select aria-label="Language" [ngModel]="langFilter()" (ngModelChange)="langFilter.set($event)">
                <option value="">All languages</option>
                @for (g of l.languages; track g) { <option [value]="g">{{ g }}</option> }
              </select>
            }
            <select aria-label="Status" [ngModel]="stateFilter()" (ngModelChange)="stateFilter.set($event)">
              <option value="">Any status</option>
              <option value="draft">Draft</option>
              <option value="changed">Edited since approval</option>
              <option value="approved">Approved</option>
              <option value="withdrawn">Approval withdrawn</option>
            </select>
            <input class="search" type="search" placeholder="Search the wording" [ngModel]="search()" (ngModelChange)="search.set($event)" />
            <div class="grow"></div>
            <button class="btn" [disabled]="busy() || !pendingCount()" (click)="approveAll()">Approve all {{ pendingCount() }} shown</button>
          </div>

          @if (!filtered().length) {
            <div class="card empty">{{ texts().length ? 'Nothing matches these filters.' : 'No wording yet. Add some, or import a CSV.' }}</div>
          } @else {
            <div class="tbl-wrap">
              <table>
                <thead><tr><th>Kind</th><th>For</th><th>Wording</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  @for (t of filtered(); track t.id) {
                    <tr>
                      <td data-label="Kind"><span class="b">{{ kindLabel(t.kind) }}</span><small>{{ t.language }}</small></td>
                      <td data-label="For">{{ forText(t) }}</td>
                      <td data-label="Wording" class="wording">
                        @if (t.title) { <b>{{ t.title }}</b> }
                        <span>{{ t.text }}</span>
                      </td>
                      <td data-label="Status">
                        <span class="bdg" [class.green]="t.state === 'approved'" [class.gold]="t.state === 'changed'" [class.grey]="t.state === 'draft' || t.state === 'withdrawn'">{{ stateLabel(t.state) }}</span>
                        @if (t.approvedVersion) { <small>v{{ t.approvedVersion }} · {{ t.approvedAt | date: 'd MMM y' }}</small> }
                      </td>
                      <td>
                        <div class="acts">
                          <button class="btn btn-sm" (click)="openEdit(t)">Edit</button>
                          @if (t.state !== 'approved') {
                            <button class="btn btn-sm" [disabled]="busy()" (click)="approveOne(t)">Approve</button>
                          }
                          @if (t.approvedVersion || t.state === 'withdrawn') {
                            <button class="btn btn-sm" (click)="openHistory(t)">History</button>
                          }
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        }

        @case ('coverage') {
          <p class="intro">What is written for a framework, and what is still missing. A report shows a gap — or the default wording, when one is set with <code>*</code> — wherever a cell is not green.</p>
          <div class="bar filters">
            <select aria-label="Framework" [ngModel]="covFramework()" (ngModelChange)="covFramework.set($event); loadCoverage()">
              <option value="">Choose a framework…</option>
              @for (f of frameworks(); track f.code) { <option [value]="f.code">{{ f.name }} (v{{ f.version }}, {{ f.status }})</option> }
            </select>
            @if (l.languages.length > 1) {
              <select aria-label="Language" [ngModel]="covLanguage()" (ngModelChange)="covLanguage.set($event); loadCoverage()">
                @for (g of l.languages; track g) { <option [value]="g">{{ g }}</option> }
              </select>
            }
            <div class="legend">
              <span class="cell approved">approved</span><span class="cell default">default used</span><span class="cell draft">draft only</span><span class="cell missing">missing</span>
            </div>
          </div>
          @if (!covFramework()) {
            <div class="card empty">Choose a framework to see which wording it needs.</div>
          } @else if (coverage(); as cv) {
            @for (k of cv.kinds; track k.kind) {
              <div class="card cov">
                <div class="cov-head">
                  <b>{{ k.label }}</b>
                  <span class="sum">
                    {{ k.approved }} approved
                    @if (k.defaulted) { · {{ k.defaulted }} default }
                    @if (k.draft) { · {{ k.draft }} draft }
                    @if (k.missing) { · <span class="miss">{{ k.missing }} missing</span> }
                  </span>
                </div>
                <div class="cells">
                  @for (c of k.cells; track $index) {
                    <button class="cell" [class]="'cell ' + c.state" (click)="coverClick(k, c)" [title]="cellTitle(k, c)">{{ cellLabel(k, c) }}</button>
                  }
                </div>
              </div>
            }
          } @else {
            <div class="empty">Loading…</div>
          }
        }

        @case ('settings') {
          <div class="card">
            <div class="f-row">
              <div class="f"><label for="cl-name">Name</label><input id="cl-name" type="text" [(ngModel)]="setName" maxlength="190" /></div>
              <div class="f"><label for="cl-notes">Notes</label><input id="cl-notes" type="text" [(ngModel)]="setNotes" placeholder="Anything the next editor should know" /></div>
            </div>
            <div class="f-row">
              <div class="f">
                <label for="cl-langs">Languages</label>
                <input id="cl-langs" type="text" [(ngModel)]="setLanguages" placeholder="en, hi" />
                <div class="hint">Short codes, comma separated (en, hi, mr …). English is the starting language. A language with wording cannot be removed.</div>
              </div>
              <div class="f">
                <label for="cl-def">Default language</label>
                <input id="cl-def" type="text" [(ngModel)]="setDefault" maxlength="10" />
                <div class="hint">Used for any piece that is not written in the language a report is asked for.</div>
              </div>
            </div>
            <div class="bar">
              <button class="btn btn-gold" [disabled]="busy()" (click)="saveSettings()">{{ busy() ? 'Saving…' : 'Save settings' }}</button>
              <div class="grow"></div>
              <button class="btn btn-danger" [disabled]="busy()" (click)="removeLibrary()">Delete library</button>
            </div>
          </div>
        }
      }
    } @else if (!error()) {
      <div class="empty">Loading…</div>
    }

    <!-- ====================================================== new library -->
    @if (newOpen()) {
      <div class="modal-root" (click)="newOpen.set(false)">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="m-head"><h3>New content library</h3><button class="m-x" (click)="newOpen.set(false)" aria-label="Close">✕</button></div>
          <div class="m-body">
            @if (modalError()) { <div class="err">{{ modalError() }}</div> }
            <div class="f full"><label for="nl-name">Name</label><input id="nl-name" type="text" [(ngModel)]="draft.name" maxlength="190" placeholder="e.g. Future Readiness – 2nd Edition" /></div>
            <div class="f full">
              <label for="nl-from">Start from</label>
              <select id="nl-from" [(ngModel)]="draft.cloneFrom">
                <option value="">An empty library</option>
                @for (x of libraries(); track x.code) { <option [value]="x.code">A copy of {{ x.name }} ({{ x.code }}) — as drafts</option> }
              </select>
              <div class="hint">A copy starts with nothing approved, so the new edition's wording is reviewed before it is used.</div>
            </div>
            <div class="f full"><label for="nl-lang">Languages</label><input id="nl-lang" type="text" [(ngModel)]="draft.languages" placeholder="en" /></div>
          </div>
          <div class="m-foot">
            <button class="btn" (click)="newOpen.set(false)">Cancel</button>
            <button class="btn btn-gold" [disabled]="busy() || draft.name.trim().length < 3" (click)="createLibrary()">{{ busy() ? 'Creating…' : 'Create library' }}</button>
          </div>
        </div>
      </div>
    }

    <!-- ========================================================= editor -->
    @if (editor(); as e) {
      <div class="modal-root" (click)="closeEditor()">
        <div class="modal wide" (click)="$event.stopPropagation()">
          <div class="m-head">
            <h3>{{ e.id ? 'Edit wording' : 'Add wording' }}</h3>
            <button class="m-x" (click)="closeEditor()" aria-label="Close">✕</button>
          </div>
          <div class="m-body">
            @if (modalError()) { <div class="err">{{ modalError() }}</div> }

            <div class="f-row">
              <div class="f">
                <label for="te-kind">Kind of text</label>
                <select id="te-kind" [(ngModel)]="e.kind" (ngModelChange)="onKind(e)" [disabled]="!!e.id">
                  @for (k of kinds(); track k.key) { <option [value]="k.key">{{ k.label }}</option> }
                </select>
                <div class="hint">{{ kindInfo(e.kind)?.help }}</div>
              </div>
              @if (lib(); as l) {
                @if (l.languages.length > 1) {
                  <div class="f">
                    <label for="te-lang">Language</label>
                    <select id="te-lang" [(ngModel)]="e.language" [disabled]="!!e.id" (ngModelChange)="queuePreview()">
                      @for (g of l.languages; track g) { <option [value]="g">{{ g }}</option> }
                    </select>
                  </div>
                }
              }
            </div>

            <div class="f-row">
              @if (kindInfo(e.kind); as ki) {
                @if (ki.scope !== 'none') {
                  <div class="f">
                    <label for="te-key">{{ ki.scope === 'competency' ? 'Competency' : ki.scope === 'dimension' ? 'Dimension' : 'Stage number' }}</label>
                    <input id="te-key" type="text" list="key-options" [(ngModel)]="e.key" [disabled]="!!e.id" placeholder="Pick one, or * for the default" autocomplete="off" />
                    <datalist id="key-options">
                      <option value="*">* — default for any</option>
                      @for (o of keyOptions(ki); track o.key) { <option [value]="o.key">{{ o.label }}</option> }
                    </datalist>
                    <div class="hint">Type <code>*</code> for wording used wherever nothing more specific is written.</div>
                  </div>
                }
                @if (ki.byLevel) {
                  <div class="f">
                    <label for="te-level">Level</label>
                    <input id="te-level" type="text" list="level-options" [(ngModel)]="e.levelKey" [disabled]="!!e.id" placeholder="Empty = any level" autocomplete="off" />
                    <datalist id="level-options">
                      @for (o of levelOptions(); track o.key) { <option [value]="o.key">{{ o.label }}</option> }
                    </datalist>
                  </div>
                }
                @if (ki.ordered) {
                  <div class="f">
                    <label for="te-pos">Position</label>
                    <input id="te-pos" type="number" min="1" max="200" [(ngModel)]="e.position" [disabled]="!!e.id" />
                    <div class="hint">The order in the list (week or question number).</div>
                  </div>
                }
              }
            </div>

            @if (kindInfo(e.kind)?.titled) {
              <div class="f full"><label for="te-title">Title</label><input id="te-title" type="text" [(ngModel)]="e.title" maxlength="190" (ngModelChange)="queuePreview()" /></div>
            }

            <div class="f full">
              <label for="te-text">Wording</label>
              <textarea id="te-text" rows="6" [(ngModel)]="e.text" (ngModelChange)="queuePreview()"></textarea>
              <div class="chips">
                @for (p of meta()?.placeholders ?? []; track p.token) {
                  <button type="button" class="chip" [title]="p.help" (click)="insert(e, p.token)">{{ '{' + p.token + '}' }}</button>
                }
              </div>
              <div class="hint">
                Click a placeholder to add it. Pronouns are neutral (they/them) unless the student's gender is recorded.
                After <code>{{ '{Subject}' }}</code> use <code>{{ '{verb:demonstrate}' }}</code> so the verb agrees; when a sentence starts with the name, write it in the past tense.
              </div>
            </div>

            <div class="sec">Preview</div>
            <div class="sample">
              <div class="f"><label for="sp-name">Student</label><input id="sp-name" type="text" [(ngModel)]="sample.name" (ngModelChange)="queuePreview()" /></div>
              <div class="f">
                <label for="sp-gender">Recorded gender</label>
                <select id="sp-gender" [(ngModel)]="sample.gender" (ngModelChange)="queuePreview()">
                  <option value="">Not recorded (they/them)</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <div class="f"><label for="sp-dim">Dimension</label><input id="sp-dim" type="text" [(ngModel)]="sample.dimension" (ngModelChange)="queuePreview()" /></div>
              <div class="f"><label for="sp-comp">Competency</label><input id="sp-comp" type="text" [(ngModel)]="sample.competency" (ngModelChange)="queuePreview()" /></div>
              <div class="f"><label for="sp-lvl">Level</label><input id="sp-lvl" type="text" [(ngModel)]="sample.levelLabel" (ngModelChange)="queuePreview()" /></div>
            </div>
            <div class="preview" [class.bad]="!!preview()?.problems?.length">
              @if (preview(); as pv) {
                @if (pv.problems.length) {
                  <ul class="problems">@for (p of pv.problems; track $index) { <li>{{ p }}</li> }</ul>
                } @else {
                  @if (e.title) { <b>{{ previewTitleText() }}</b> }
                  <p>{{ pv.text || '—' }}</p>
                  @if (pv.missing.length) {
                    <small class="warn">No sample value for {{ pv.missing.join(', ') }} — fill the boxes above to see the full text.</small>
                  }
                }
              } @else {
                <small class="muted">The preview appears as you type.</small>
              }
            </div>

            @if (e.id) {
              <div class="statusline">
                <span class="bdg" [class.green]="e.state === 'approved'" [class.gold]="e.state === 'changed'" [class.grey]="e.state === 'draft' || e.state === 'withdrawn'">{{ e.state === 'new' ? '' : stateLabel(e.state) }}</span>
                @if (e.approvedVersion) { <small>Reports currently use version {{ e.approvedVersion }}.</small> }
                @if (e.state === 'changed' && e.approvedText) {
                  <details><summary>See the approved wording</summary><p class="approved-text">{{ e.approvedText }}</p></details>
                }
              </div>
            }
          </div>
          <div class="m-foot">
            @if (e.id) {
              @if (e.state === 'draft') {
                <button class="btn btn-danger" [disabled]="busy()" (click)="deleteText(e)">Delete</button>
              }
              @if (e.state === 'changed') {
                <button class="btn" [disabled]="busy()" (click)="revertText(e)">Back to approved</button>
              }
              @if (e.state === 'approved' || e.state === 'changed') {
                <button class="btn" [disabled]="busy()" (click)="withdrawText(e)">Withdraw approval</button>
              }
            }
            <div class="grow"></div>
            <button class="btn" (click)="closeEditor()">Cancel</button>
            <button class="btn" [disabled]="busy()" (click)="saveText(e, false)">Save draft</button>
            <button class="btn btn-gold" [disabled]="busy()" (click)="saveText(e, true)">Save and approve</button>
          </div>
        </div>
      </div>
    }

    <!-- ========================================================= history -->
    @if (history(); as h) {
      <div class="modal-root" (click)="history.set(null)">
        <div class="modal wide" (click)="$event.stopPropagation()">
          <div class="m-head"><h3>Version history — {{ kindLabel(h.row.kind) }} {{ forText(h.row) }}</h3><button class="m-x" (click)="history.set(null)" aria-label="Close">✕</button></div>
          <div class="m-body">
            @if (!h.versions.length) {
              <div class="empty">Nothing has been approved yet.</div>
            }
            @for (v of h.versions; track v.version) {
              <div class="ver" [class.live]="v.live">
                <div class="ver-head">
                  <b>Version {{ v.version }}</b>
                  @if (v.live) { <span class="bdg green">In use</span> }
                  <small>{{ v.approvedAt | date: 'd MMM y, h:mm a' }} · {{ v.approvedByName || 'unknown' }}</small>
                </div>
                @if (v.title) { <b>{{ v.title }}</b> }
                <p>{{ v.text }}</p>
                @if (v.note) { <small class="muted">Note: {{ v.note }}</small> }
              </div>
            }
          </div>
          <div class="m-foot"><button class="btn" (click)="history.set(null)">Close</button></div>
        </div>
      </div>
    }

    <!-- ========================================================== import -->
    @if (importing(); as im) {
      <div class="modal-root" (click)="importing.set(null)">
        <div class="modal wide" (click)="$event.stopPropagation()">
          <div class="m-head"><h3>Import wording from {{ im.fileName }}</h3><button class="m-x" (click)="importing.set(null)" aria-label="Close">✕</button></div>
          <div class="m-body">
            @if (modalError()) { <div class="err">{{ modalError() }}</div> }
            <div class="stats">
              <div class="stat"><b>{{ im.result.created }}</b><small>new</small></div>
              <div class="stat"><b>{{ im.result.updated }}</b><small>changed</small></div>
              <div class="stat"><b>{{ im.result.unchanged }}</b><small>already the same</small></div>
              <div class="stat"><b>{{ im.result.errors.length }}</b><small>with problems</small></div>
            </div>
            <p class="hint">Imported wording becomes a <b>draft</b> — nothing is approved until you approve it. Columns: kind, key, level, language, position, title, text.</p>
            @if (im.result.errors.length) {
              <div class="bulk-errors-wrap">
                <table class="mini">
                  <thead><tr><th>Row</th><th>Problem</th></tr></thead>
                  <tbody>@for (x of im.result.errors; track x.row) { <tr><td>{{ x.row }}</td><td>{{ x.message }}</td></tr> }</tbody>
                </table>
              </div>
              <p class="hint">Fix these rows in the file and import again. Nothing is saved while there are problems.</p>
            }
          </div>
          <div class="m-foot">
            <button class="btn" (click)="importing.set(null)">Cancel</button>
            <button class="btn btn-gold" [disabled]="busy() || im.result.errors.length > 0 || (im.result.created + im.result.updated) === 0" (click)="confirmImport()">{{ busy() ? 'Importing…' : 'Import ' + (im.result.created + im.result.updated) + ' pieces as drafts' }}</button>
          </div>
        </div>
      </div>
    }

    @if (toast()) {
      <div class="toast">{{ toast() }}</div>
    }
  `,
  styles: [
    ADMIN_UI_CSS,
    `
      .back { display: inline-block; color: var(--muted, #9fb0d0); font-size: 0.85rem; font-weight: 600; margin-bottom: 0.9rem; }
      .back:hover { color: var(--gold-2, #f5cc5a); }
      .intro { color: var(--muted, #9fb0d0); font-size: 0.9rem; max-width: 85ch; margin: 0 0 1.2rem; }
      a.link:hover { color: var(--gold-2, #f5cc5a); }
      code { background: rgba(255,255,255,0.07); padding: 0.1rem 0.4rem; border-radius: 6px; font-size: 0.82rem; }
      .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem; }
      .titles { min-width: 0; flex: 1 1 320px; }
      .titles h2 { margin: 0.2rem 0 0.25rem; font-size: 1.5rem; line-height: 1.2; text-wrap: balance; }
      .codeline { color: var(--faint, #6e7f9e); font-size: 0.8rem; font-weight: 700; }
      .actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
      .file-btn { cursor: pointer; position: relative; }
      .file-btn input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; }
      .tabs { display: flex; flex-wrap: wrap; width: 100%; }
      .tab { flex: 1 1 auto; min-width: 0; padding: 0.45rem 0.5rem; }
      .filters { flex-wrap: wrap; gap: 0.5rem; }
      .filters select, .filters .search { width: auto; min-width: 150px; max-width: 100%; }
      .filters .search { flex: 1 1 200px; }
      td.wording { max-width: 560px; }
      td.wording b { display: block; }
      td.wording span { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; color: var(--muted, #9fb0d0); font-size: 0.86rem; }
      td small { display: block; color: var(--faint, #6e7f9e); }
      .cov { margin-bottom: 0.8rem; }
      .cov-head { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.6rem; }
      .cov-head .sum { color: var(--muted, #9fb0d0); font-size: 0.82rem; }
      .miss { color: #fda4af; font-weight: 700; }
      .cells { display: flex; flex-wrap: wrap; gap: 0.35rem; }
      .cell { border: 1px solid transparent; border-radius: 8px; padding: 0.25rem 0.55rem; font-size: 0.76rem; font-weight: 600; background: none; color: inherit; cursor: pointer; }
      .legend { display: flex; gap: 0.35rem; flex-wrap: wrap; margin-left: auto; }
      .legend .cell { cursor: default; }
      .cell.approved { background: rgba(52, 211, 153, 0.16); border-color: rgba(52, 211, 153, 0.45); color: #6ee7b7; }
      .cell.default { background: rgba(96, 165, 250, 0.14); border-color: rgba(96, 165, 250, 0.4); color: #93c5fd; }
      .cell.draft { background: rgba(232, 182, 74, 0.15); border-color: rgba(232, 182, 74, 0.45); color: var(--gold-2, #f5cc5a); }
      .cell.missing { background: rgba(251, 113, 133, 0.1); border-color: rgba(251, 113, 133, 0.4); color: #fda4af; }
      button.cell:hover { filter: brightness(1.25); }
      .chips { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.4rem; }
      .chip { font-size: 0.74rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 999px; border: 1px solid var(--line-2, rgba(255,255,255,0.16)); background: none; color: var(--muted, #9fb0d0); cursor: pointer; }
      .chip:hover { color: var(--gold-2, #f5cc5a); border-color: var(--gold-2, #f5cc5a); }
      .sample { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.6rem; }
      .preview { margin-top: 0.7rem; padding: 0.8rem 1rem; border: 1px solid var(--line, rgba(255,255,255,0.09)); border-radius: 12px; background: rgba(0,0,0,0.2); min-height: 3rem; }
      .preview p { margin: 0.2rem 0 0; line-height: 1.55; max-width: 70ch; }
      .preview.bad { border-color: rgba(251, 113, 133, 0.45); }
      .problems { margin: 0; padding-left: 1.1rem; color: #fda4af; font-size: 0.86rem; display: grid; gap: 0.25rem; }
      .warn { color: #fcd34d; }
      .muted { color: var(--faint, #6e7f9e); }
      .statusline { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; margin-top: 0.9rem; }
      .approved-text { margin: 0.4rem 0 0; color: var(--muted, #9fb0d0); font-size: 0.86rem; max-width: 70ch; }
      .ver { padding: 0.7rem 0.9rem; border: 1px solid var(--line, rgba(255,255,255,0.09)); border-radius: 12px; margin-bottom: 0.6rem; background: rgba(0,0,0,0.16); }
      .ver.live { border-color: rgba(52, 211, 153, 0.4); }
      .ver-head { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; }
      .ver p { margin: 0.35rem 0; line-height: 1.5; max-width: 70ch; }
      .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 0.6rem; margin-bottom: 0.8rem; }
      .m-foot .grow { flex: 1; }
      @media (max-width: 700px) {
        .actions { width: 100%; }
        .actions .btn { flex: 1 1 auto; justify-content: center; }
        .legend { margin-left: 0; }
      }
    `,
  ],
})
export class AdminContentLibraryPage implements OnInit {
  private readonly api = inject(ScorecardAdminApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly code = signal('');
  protected readonly meta = signal<ContentMeta | null>(null);
  protected readonly libraries = signal<LibraryRow[]>([]);
  protected readonly lib = signal<LibraryRow | null>(null);
  protected readonly texts = signal<TextRow[]>([]);
  protected readonly frameworks = signal<FrameworkRow[]>([]);
  protected readonly fwConfig = signal<FrameworkConfig | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly modalError = signal('');
  protected readonly toast = signal('');
  protected readonly busy = signal(false);
  protected readonly tab = signal<Tab>('wording');
  protected readonly newOpen = signal(false);

  protected readonly kindFilter = signal('');
  protected readonly langFilter = signal('');
  protected readonly stateFilter = signal('');
  protected readonly search = signal('');

  protected readonly covFramework = signal('');
  protected readonly covLanguage = signal('');
  protected readonly coverage = signal<CoverageResponse | null>(null);

  protected readonly editor = signal<TextEditor | null>(null);
  protected readonly preview = signal<TemplatePreview | null>(null);
  protected readonly previewTitleText = signal('');
  protected readonly history = signal<{ row: TextRow; versions: TextVersionRow[] } | null>(null);
  protected readonly importing = signal<{ fileName: string; csv: string; result: ImportResult } | null>(null);

  protected draft = { name: '', cloneFrom: '', languages: 'en' };
  protected setName = '';
  protected setNotes = '';
  protected setLanguages = '';
  protected setDefault = '';
  protected sample = { name: 'Aarav Mehta', gender: '', dimension: 'THINK', competency: 'Logical Reasoning', levelLabel: 'Proficient' };
  private previewTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly kinds = computed(() => this.meta()?.kinds ?? []);

  protected readonly filtered = computed(() => {
    const kind = this.kindFilter();
    const lang = this.langFilter();
    const state = this.stateFilter();
    const q = this.search().trim().toLowerCase();
    return this.texts().filter(
      (t) =>
        (!kind || t.kind === kind) &&
        (!lang || t.language === lang) &&
        (!state || t.state === state) &&
        (!q || `${t.title ?? ''} ${t.text} ${t.key}`.toLowerCase().includes(q)),
    );
  });

  protected readonly pendingCount = computed(() => this.filtered().filter((t) => t.state !== 'approved').length);

  ngOnInit(): void {
    this.api.contentMeta().subscribe({ next: (m) => this.meta.set(m), error: (e) => this.error.set(errText(e)) });
    this.api.frameworks().subscribe({
      next: (f) => {
        this.frameworks.set(f);
        const pick = f.find((x) => x.status === 'Published') ?? f[0];
        if (pick) this.loadFrameworkConfig(pick.code);
      },
    });
    this.route.paramMap.subscribe((p) => {
      this.code.set(p.get('code') ?? '');
      this.error.set('');
      this.lib.set(null);
      this.tab.set('wording');
      this.coverage.set(null);
      this.load();
    });
  }

  private loadFrameworkConfig(code: string): void {
    this.api.framework(code).subscribe({ next: (f) => this.fwConfig.set(f.config) });
  }

  private load(): void {
    if (!this.code()) {
      this.loading.set(true);
      this.api.libraries().subscribe({
        next: (l) => {
          this.libraries.set(l);
          this.loading.set(false);
        },
        error: (e) => {
          this.error.set(errText(e));
          this.loading.set(false);
        },
      });
      return;
    }
    this.api.library(this.code()).subscribe({
      next: (l) => {
        this.lib.set(l);
        this.covLanguage.set(l.defaultLanguage);
      },
      error: (e) => this.error.set(errText(e)),
    });
    this.loadTexts();
  }

  private loadTexts(): void {
    this.api.texts(this.code(), {}).subscribe({ next: (r) => this.texts.set(r.items), error: (e) => this.error.set(errText(e)) });
  }

  /** Counts on the header change whenever wording does. */
  private refreshLibrary(): void {
    this.api.library(this.code()).subscribe({ next: (l) => this.lib.set(l) });
    this.loadTexts();
    if (this.tab() === 'coverage') this.loadCoverage();
  }

  private flash(msg: string): void {
    this.toast.set(msg);
    setTimeout(() => this.toast() === msg && this.toast.set(''), 2800);
  }

  protected seasonNames(l: LibraryRow): string {
    return l.seasons.map((s) => s.name).join(', ');
  }

  protected kindInfo(key: string): TextKindInfo | undefined {
    return this.kinds().find((k) => k.key === key);
  }

  protected kindLabel(key: string): string {
    return this.kindInfo(key)?.label ?? key;
  }

  protected stateLabel(s: TextState): string {
    return STATE_LABEL[s];
  }

  protected forText(t: { kind: string; key: string; levelKey: string; position: number }): string {
    const ki = this.kindInfo(t.kind);
    const parts: string[] = [];
    if (t.key) parts.push(t.key === '*' ? 'Default (any)' : this.keyName(t.key, ki));
    if (ki?.byLevel) parts.push(t.levelKey ? this.levelName(t.levelKey) : 'Any level');
    if (ki?.ordered) parts.push(`#${t.position}`);
    return parts.join(' · ') || '—';
  }

  private keyName(key: string, ki?: TextKindInfo): string {
    const cfg = this.fwConfig();
    if (!cfg) return key;
    if (ki?.scope === 'competency') return cfg.competencies.find((c) => c.key === key)?.name ?? key;
    if (ki?.scope === 'dimension') return cfg.dimensions.find((d) => d.key === key)?.label ?? key;
    if (ki?.scope === 'stage') return `Stage ${key}`;
    return key;
  }

  private levelName(key: string): string {
    const cfg = this.fwConfig();
    const scale = cfg?.scales.find((s) => s.key === cfg.defaultScale) ?? cfg?.scales[0];
    return scale?.levels.find((l) => l.key === key)?.label ?? key;
  }

  protected keyOptions(ki: TextKindInfo): { key: string; label: string }[] {
    const cfg = this.fwConfig();
    if (!cfg) return [];
    if (ki.scope === 'competency') return cfg.competencies.map((c) => ({ key: c.key, label: c.name }));
    if (ki.scope === 'dimension') return cfg.dimensions.map((d) => ({ key: d.key, label: d.label }));
    if (ki.scope === 'stage') {
      const stages = new Set(cfg.competencies.flatMap((c) => Object.keys(c.stageNames ?? {})));
      ['1', '2', '3', '4'].forEach((s) => stages.add(s));
      return [...stages].sort((a, b) => Number(a) - Number(b)).map((s) => ({ key: s, label: `Stage ${s}` }));
    }
    return [];
  }

  protected levelOptions(): { key: string; label: string }[] {
    const cfg = this.fwConfig();
    const scale = cfg?.scales.find((s) => s.key === cfg.defaultScale) ?? cfg?.scales[0];
    return (scale?.levels ?? []).map((l) => ({ key: l.key, label: l.label }));
  }

  // ------------------------------------------------------------ libraries
  protected openNew(): void {
    this.draft = { name: '', cloneFrom: '', languages: 'en' };
    this.modalError.set('');
    this.newOpen.set(true);
  }

  private parseLanguages(s: string): string[] {
    return s.split(/[,\s]+/).map((x) => x.trim()).filter(Boolean);
  }

  protected createLibrary(): void {
    this.busy.set(true);
    this.modalError.set('');
    const languages = this.parseLanguages(this.draft.languages);
    this.api.createLibrary({ name: this.draft.name.trim(), cloneFrom: this.draft.cloneFrom || undefined, languages: languages.length ? languages : ['en'], defaultLanguage: languages[0] || 'en' }).subscribe({
      next: (l) => {
        this.busy.set(false);
        this.newOpen.set(false);
        this.router.navigate(['/admin/scorecard/content', l.code]);
      },
      error: (e) => {
        this.busy.set(false);
        this.modalError.set(errText(e));
      },
    });
  }

  protected openSettings(): void {
    const l = this.lib();
    if (!l) return;
    this.setName = l.name;
    this.setNotes = l.notes ?? '';
    this.setLanguages = l.languages.join(', ');
    this.setDefault = l.defaultLanguage;
    this.error.set('');
    this.tab.set('settings');
  }

  protected saveSettings(): void {
    this.busy.set(true);
    this.error.set('');
    this.api
      .updateLibrary(this.code(), { name: this.setName.trim(), notes: this.setNotes, languages: this.parseLanguages(this.setLanguages), defaultLanguage: this.setDefault.trim() })
      .subscribe({
        next: (l) => {
          this.busy.set(false);
          this.lib.set(l);
          this.flash('Settings saved');
        },
        error: (e) => {
          this.busy.set(false);
          this.error.set(errText(e));
          window.scrollTo({ top: 0, behavior: 'smooth' });
        },
      });
  }

  protected removeLibrary(): void {
    if (!confirm('Delete this library and all its wording? Reports that used it keep working only if another library is chosen for the season. This cannot be undone.')) return;
    this.busy.set(true);
    this.api.deleteLibrary(this.code()).subscribe({
      next: () => this.router.navigate(['/admin/scorecard/content']),
      error: (e) => {
        this.busy.set(false);
        this.error.set(errText(e));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
    });
  }

  // --------------------------------------------------------------- wording
  protected openNewText(prefill: Partial<TextEditor> | null): void {
    const l = this.lib();
    const kind = prefill?.kind ?? (this.kindFilter() || this.kinds()[0]?.key || 'strength');
    this.modalError.set('');
    this.preview.set(null);
    this.editor.set({
      id: null,
      kind,
      key: prefill?.key ?? '',
      levelKey: prefill?.levelKey ?? '',
      language: prefill?.language || this.langFilter() || l?.defaultLanguage || 'en',
      position: prefill?.position ?? (this.kindInfo(kind)?.ordered ? 1 : 0),
      title: '',
      text: '',
      state: 'new',
      approvedVersion: null,
      approvedText: null,
    });
    this.queuePreview();
  }

  protected openEdit(t: TextRow): void {
    this.modalError.set('');
    this.editor.set({
      id: t.id,
      kind: t.kind,
      key: t.key,
      levelKey: t.levelKey,
      language: t.language,
      position: t.position,
      title: t.title ?? '',
      text: t.text,
      state: t.state,
      approvedVersion: t.approvedVersion,
      approvedText: t.approvedText,
    });
    this.sample.dimension = t.kind.startsWith('dimension') || t.kind === 'challenge' || t.kind === 'wisdom' ? t.key : this.sample.dimension;
    this.queuePreview();
  }

  protected closeEditor(): void {
    this.editor.set(null);
    this.preview.set(null);
  }

  protected onKind(e: TextEditor): void {
    const ki = this.kindInfo(e.kind);
    if (ki && ki.scope === 'none') e.key = '';
    if (ki && !ki.byLevel) e.levelKey = '';
    if (ki) e.position = ki.ordered ? Math.max(1, e.position) : 0;
    this.queuePreview();
  }

  protected insert(e: TextEditor, token: string): void {
    const t = token === 'verb:demonstrate' ? '{verb:demonstrate}' : `{${token}}`;
    e.text = e.text + (e.text && !e.text.endsWith(' ') ? ' ' : '') + t;
    this.queuePreview();
  }

  protected queuePreview(): void {
    if (this.previewTimer) clearTimeout(this.previewTimer);
    this.previewTimer = setTimeout(() => {
      const e = this.editor();
      if (!e) return;
      this.api.previewTemplate({ text: e.text, ...this.sampleBody() }).subscribe({
        next: (p) => this.preview.set(p),
        error: (err) => this.preview.set({ problems: [errText(err)], text: '', missing: [] }),
      });
      if (e.title) {
        this.api.previewTemplate({ text: e.title, ...this.sampleBody() }).subscribe({ next: (p) => this.previewTitleText.set(p.text) });
      } else this.previewTitleText.set('');
    }, 300);
  }

  private sampleBody() {
    return { name: this.sample.name, gender: this.sample.gender, dimension: this.sample.dimension, competency: this.sample.competency, levelLabel: this.sample.levelLabel };
  }

  protected saveText(e: TextEditor, approve: boolean): void {
    if (!e.text.trim()) return this.modalError.set('Write the wording first.');
    this.busy.set(true);
    this.modalError.set('');
    const ki = this.kindInfo(e.kind);
    this.api
      .saveText(this.code(), {
        kind: e.kind,
        key: ki?.scope === 'none' ? '' : e.key.trim(),
        levelKey: ki?.byLevel ? e.levelKey.trim() : '',
        language: e.language,
        position: ki?.ordered ? Number(e.position) || 0 : 0,
        title: ki?.titled ? e.title.trim() : undefined,
        text: e.text,
      })
      .subscribe({
        next: (row) => {
          if (!approve) return this.afterSave('Draft saved');
          this.api.approveText(this.code(), row.id).subscribe({
            next: () => this.afterSave('Saved and approved'),
            error: (err) => {
              this.busy.set(false);
              // an unchanged text is already approved: that is fine, not an error
              if (/Nothing has changed/.test(errText(err))) return this.afterSave('Saved — already approved');
              this.modalError.set(errText(err));
              this.refreshLibrary();
            },
          });
        },
        error: (err) => {
          this.busy.set(false);
          this.modalError.set(errText(err));
        },
      });
  }

  private afterSave(msg: string): void {
    this.busy.set(false);
    this.closeEditor();
    this.flash(msg);
    this.refreshLibrary();
  }

  protected approveOne(t: TextRow): void {
    this.busy.set(true);
    this.api.approveText(this.code(), t.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.flash('Approved');
        this.refreshLibrary();
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(errText(e));
      },
    });
  }

  protected approveAll(): void {
    const n = this.pendingCount();
    if (!n) return;
    if (!confirm(`Approve ${n} piece(s) of wording? Reports will start using them straight away.`)) return;
    this.busy.set(true);
    this.api.approveAll(this.code(), { kind: this.kindFilter() || undefined, language: this.langFilter() || undefined }).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.flash(`${r.approved} approved`);
        this.refreshLibrary();
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(errText(e));
      },
    });
  }

  protected revertText(e: TextEditor): void {
    if (!e.id) return;
    this.busy.set(true);
    this.api.revertText(this.code(), e.id).subscribe({
      next: () => this.afterSave('Back to the approved wording'),
      error: (err) => {
        this.busy.set(false);
        this.modalError.set(errText(err));
      },
    });
  }

  protected withdrawText(e: TextEditor): void {
    if (!e.id) return;
    if (!confirm('Withdraw the approval? Reports stop using this wording (they show the default, or a gap) until it is approved again. Earlier versions stay on record.')) return;
    this.busy.set(true);
    this.api.withdrawText(this.code(), e.id).subscribe({
      next: () => this.afterSave('Approval withdrawn'),
      error: (err) => {
        this.busy.set(false);
        this.modalError.set(errText(err));
      },
    });
  }

  protected deleteText(e: TextEditor): void {
    if (!e.id || !confirm('Delete this draft? This cannot be undone.')) return;
    this.busy.set(true);
    this.api.deleteText(this.code(), e.id).subscribe({
      next: () => this.afterSave('Deleted'),
      error: (err) => {
        this.busy.set(false);
        this.modalError.set(errText(err));
      },
    });
  }

  protected openHistory(t: TextRow): void {
    this.api.textVersions(this.code(), t.id).subscribe({
      next: (versions) => this.history.set({ row: t, versions }),
      error: (e) => this.error.set(errText(e)),
    });
  }

  // ------------------------------------------------------------ CSV in/out
  protected exportCsv(): void {
    this.api.exportTexts(this.code(), this.langFilter() || undefined).subscribe({ error: (e) => this.error.set(errText(e)) });
  }

  protected async onFile(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const csv = await file.text();
    this.modalError.set('');
    this.api.importTexts(this.code(), csv, true).subscribe({
      next: (result) => this.importing.set({ fileName: file.name, csv, result }),
      error: (e) => this.error.set(errText(e)),
    });
  }

  protected confirmImport(): void {
    const im = this.importing();
    if (!im) return;
    this.busy.set(true);
    this.modalError.set('');
    this.api.importTexts(this.code(), im.csv, false).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.importing.set(null);
        this.flash(`${r.created} added, ${r.updated} updated — as drafts`);
        this.refreshLibrary();
      },
      error: (e) => {
        this.busy.set(false);
        this.modalError.set(errText(e));
      },
    });
  }

  // -------------------------------------------------------------- coverage
  protected openCoverage(): void {
    this.tab.set('coverage');
    if (!this.covFramework()) {
      const pick = this.frameworks().find((f) => f.status === 'Published') ?? this.frameworks()[0];
      if (pick) this.covFramework.set(pick.code);
    }
    this.loadCoverage();
  }

  protected loadCoverage(): void {
    if (!this.covFramework()) return;
    this.coverage.set(null);
    this.loadFrameworkConfig(this.covFramework());
    this.api.coverage(this.code(), this.covFramework(), this.covLanguage() || undefined).subscribe({
      next: (c) => this.coverage.set(c),
      error: (e) => this.error.set(errText(e)),
    });
  }

  protected cellLabel(k: CoverageKind, c: CoverageCell): string {
    const parts = [c.keyLabel, c.levelLabel].filter(Boolean);
    return parts.join(' · ') || (k.ordered ? 'List' : 'Text');
  }

  protected cellTitle(k: CoverageKind, c: CoverageCell): string {
    const what = { approved: 'Approved', default: 'The default wording is used', draft: 'Written but not approved yet', missing: 'Nothing written' }[c.state];
    return `${what}. ${k.ordered ? 'Click to open the list.' : 'Click to write or edit it.'}`;
  }

  protected coverClick(k: CoverageKind, c: CoverageCell): void {
    if (k.ordered) {
      this.kindFilter.set(k.kind);
      this.tab.set('wording');
      return;
    }
    const lang = this.covLanguage() || this.lib()?.defaultLanguage || 'en';
    const existing = this.texts().find((t) => t.kind === k.kind && t.key === c.key && t.levelKey === c.level && t.language === lang && t.position === 0);
    if (existing) return this.openEdit(existing);
    this.openNewText({ kind: k.kind, key: c.key, levelKey: c.level, language: lang });
    this.sample.dimension = k.scope === 'dimension' ? c.keyLabel : this.sample.dimension;
    this.sample.competency = k.scope === 'competency' ? c.keyLabel : this.sample.competency;
    if (c.levelLabel) this.sample.levelLabel = c.levelLabel;
  }
}
