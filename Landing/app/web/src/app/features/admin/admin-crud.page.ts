import { ChangeDetectorRef, Component, HostListener, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import { ADMIN_UI_CSS } from './admin-ui';
import { CRUD_MODULES, CrudConfig, FieldDef } from './crud.config';
import { MediaLibraryModal } from './media-library-modal';
import { RichTextEditorComponent } from './rich-text-editor';

type Row = Record<string, unknown>;

interface ListResult {
  data: Row[];
  total: number;
  page: number;
  limit: number;
}

interface BulkUploadResult {
  total: number;
  created: number;
  failed: number;
  errors: { row: number; message: string }[];
}

// Shape of both GET .../merge-preview endpoints — school and student
// previews share keep/merge, then diverge (see
// RegistrationService.previewSchoolMerge/previewStudentMerge), so every
// field past that is optional and the template branches on
// action.merge.noun to know which half actually applies.
interface MergePreviewResult {
  keep: { code: string; name: string; verified?: boolean; grade?: string };
  merge: { code: string; name: string; verified?: boolean; grade?: string };
  studentsToMove?: number;
  paidRegistrationsToMove?: number;
  movable?: number;
  conflicts?: { code: string; competitionCode: string; competitionTitle: string }[];
}

function errText(err: unknown): string {
  const e = err as { error?: { message?: string }; message?: string };
  return e?.error?.message ?? e?.message ?? 'Something went wrong';
}

function isoDate(v: unknown): string {
  if (typeof v !== 'string') return '';
  return v.slice(0, 10);
}

@Component({
  selector: 'app-admin-crud',
  standalone: true,
  imports: [CommonModule, FormsModule, MediaLibraryModal, RichTextEditorComponent],
  template: `
    <div class="bar">
      @if (cfg.search !== false) {
        <input class="search" placeholder="Search…" [(ngModel)]="search" (keyup.enter)="applySearch()" />
      }
      @for (f of cfg.filters ?? []; track f.key) {
        <select class="filter" [ngModel]="filters[f.key] ?? ''" (ngModelChange)="setFilter(f.key, $event)">
          <option value="">All {{ f.label }}</option>
          @for (opt of filterOptions(f); track opt) {
            <option [value]="opt">{{ filterLabel(f, opt) }}</option>
          }
        </select>
      }
      <div class="grow"></div>
      @if (cfg.export) {
        <button class="btn" [disabled]="exportBusy" (click)="exportXlsx()">
          {{ exportBusy ? 'Preparing…' : '⇩ ' + (cfg.export.label ?? 'Export') }}
        </button>
      }
      @if (cfg.bulkUpload) {
        <button class="btn" (click)="openBulk()">⇪ Bulk Upload</button>
      }
      @if (cfg.canCreate) {
        <button class="btn btn-gold" (click)="openCreate()">+ {{ cfg.createText ?? 'Add' }}</button>
      }
    </div>

    @if (error) {
      <div class="err">{{ error }}</div>
    }

    <div class="tbl-wrap" (scroll)="closeMenu()">
      <table>
        <thead>
          <tr>
            @for (c of cfg.columns; track c.key) {
              <th>{{ c.label }}</th>
            }
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row[cfg.keyField ?? 'code']) {
            <tr>
              @for (c of cfg.columns; track c.key) {
                <td [attr.data-label]="c.label">
                  @switch (c.type) {
                    @case ('badge') {
                      <span class="bdg" [ngClass]="badgeClass(c, row[c.key])">{{ row[c.key] ?? '—' }}</span>
                    }
                    @case ('date') {
                      {{ row[c.key] ? isoDate(row[c.key]) : '—' }}
                    }
                    @case ('datetime') {
                      {{ row[c.key] ? datetime(row[c.key]) : '—' }}
                    }
                    @case ('time') {
                      {{ row[c.key] ? timeStr(row[c.key]) : '—' }}
                    }
                    @case ('money') {
                      ₹{{ row[c.key] ?? '—' }}
                    }
                    @case ('array') {
                      {{ arrayText(row[c.key]) }}
                    }
                    @case ('boolean') {
                      <span class="bdg" [ngClass]="row[c.key] ? 'green' : 'grey'">{{ row[c.key] ? 'Yes' : 'No' }}</span>
                    }
                    @case ('richtext') {
                      <span class="b">{{ plainText(row[c.key]) }}</span>
                    }
                    @default {
                      <span class="b">{{ row[c.key] ?? '—' }}</span>
                    }
                  }
                </td>
              }
              <td>
                <div class="kebab-wrap">
                  <button class="btn btn-sm kebab-btn" title="Actions" (click)="$event.stopPropagation(); toggleMenu(rowKey(row), $event)">&#8942;</button>
                  @if (openMenuFor() === rowKey(row)) {
                    <div class="kebab-menu" [style.position]="'fixed'" [style.top]="menuPos()?.top ? menuPos()!.top + 'px' : 'auto'" [style.bottom]="menuPos()?.bottom ? menuPos()!.bottom + 'px' : 'auto'" [style.right.px]="menuPos()?.right" (click)="$event.stopPropagation()">
                      @if (cfg.canView) {
                        <button type="button" (click)="view(row); closeMenu()">View</button>
                      }
                      @if (cfg.profile) {
                        <button type="button" (click)="openEditProfile(row); closeMenu()">Edit Profile</button>
                      }
                      @if (cfg.canEdit) {
                        <button type="button" (click)="openEdit(row); closeMenu()">Edit</button>
                      }
                      @for (action of cfg.rowActions ?? []; track action.label) {
                        @if (!action.visible || action.visible(row)) {
                          @if (action.merge) {
                            <button type="button" (click)="openMerge(row, action); closeMenu()">{{ action.label }}</button>
                          } @else if (action.loginLink) {
                            <button type="button" (click)="openLoginLink(row, action); closeMenu()">{{ action.label }}</button>
                          } @else {
                            <button type="button" (click)="runRowAction(row, action); closeMenu()">{{ action.label }}</button>
                          }
                        }
                      }
                      @if (cfg.canArchive && !row['archived']) {
                        <button type="button" (click)="archive(row); closeMenu()">Archive</button>
                      }
                      @if (cfg.canDelete) {
                        <button type="button" class="danger" (click)="remove(row); closeMenu()">Delete</button>
                      }
                    </div>
                  }
                </div>
              </td>
            </tr>
          } @empty {
            <tr><td [attr.colspan]="cfg.columns.length + 1" class="empty">No records found.</td></tr>
          }
        </tbody>
      </table>
    </div>

    @if (cfg.paginated !== false && total() > 0) {
      <div class="pager">
        <span>{{ ((page() - 1) * limit + 1) }}–{{ min(page() * limit, total()) }} of {{ total() }}</span>
        <button class="btn btn-sm" [disabled]="page() <= 1" (click)="go(page() - 1)">← Prev</button>
        <button class="btn btn-sm" [disabled]="page() * limit >= total()" (click)="go(page() + 1)">Next →</button>
      </div>
    }

    @if (modalOpen) {
      <div class="modal-root" (click)="closeModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="m-head">
            <h3>{{ editMode === 'profile' ? (cfg.profile?.title ?? 'Edit Profile') : (editing ? 'Edit' : 'Add') }} {{ editMode === 'profile' ? '' : cfg.singular }}</h3>
            <button class="m-x" (click)="closeModal()">✕</button>
          </div>
          <div class="m-body">
            @if (modalError) {
              <div class="err">{{ modalError }}</div>
            }
            @if (profileLoading()) {
              <div style="padding:0.6rem 0;color:var(--muted, #9fb0d0);font-size:0.85rem">Loading…</div>
            } @else {
            <div class="f-row">
              @for (f of formFields(); track f.key) {
                <div class="f" [ngClass]="{ col: f.col, full: !f.col }">
                  <label>{{ f.label }}@if (f.required) { * }</label>
                  @switch (f.type) {
                    @case ('select') {
                      <select [(ngModel)]="form[f.key]">
                        <option value="">—</option>
                        @for (opt of fieldOptions(f); track opt) {
                          <option [value]="opt">{{ fieldOptionLabel(f, opt) }}</option>
                        }
                      </select>
                    }
                    @case ('textarea') {
                      <textarea [(ngModel)]="form[f.key]" [rows]="f.rows ?? 3"></textarea>
                    }
                    @case ('richtext') {
                      <app-rich-text-editor
                        [value]="$any(form[f.key]) ?? ''"
                        (valueChange)="form[f.key] = $event"
                        [placeholder]="f.placeholder ?? ''"
                      />
                    }
                    @case ('checkbox') {
                      <input type="checkbox" [(ngModel)]="form[f.key]" />
                    }
                    @case ('date') {
                      <input type="date" [(ngModel)]="form[f.key]" />
                    }
                    @case ('time') {
                      <div class="time-pick">
                        <select [ngModel]="timeParts(f.key).h" (ngModelChange)="setTime(f.key, 'h', $event)">
                          @for (h of timeHours(f.key); track h) {
                            <option [value]="h">{{ h }}</option>
                          }
                        </select>
                        <span class="tsep">:</span>
                        <select [ngModel]="timeParts(f.key).m" (ngModelChange)="setTime(f.key, 'm', $event)">
                          @for (m of timeMinutes(); track m) {
                            <option [value]="m">{{ m }}</option>
                          }
                        </select>
                        <select class="ap" [ngModel]="timeParts(f.key).ap" (ngModelChange)="setTime(f.key, 'ap', $event)">
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                      </div>
                    }
                    @case ('number') {
                      <input type="number" [(ngModel)]="form[f.key]" [placeholder]="f.placeholder ?? ''" />
                    }
                    @case ('password') {
                      <input type="password" [(ngModel)]="form[f.key]" [placeholder]="f.placeholder ?? ''" />
                    }
                    @case ('lines') {
                      <textarea [(ngModel)]="form[f.key]" rows="4" [placeholder]="f.placeholder ?? 'One per line'"></textarea>
                    }
                    @case ('checklist') {
                      <div class="checklist-grid">
                        @for (opt of f.checklistOptions ?? []; track opt.value) {
                          <label class="checklist-item">
                            <input
                              type="checkbox"
                              [checked]="asChecklist(form[f.key]).includes(opt.value)"
                              (change)="toggleChecklist(f.key, opt.value, $event)"
                            />
                            {{ opt.label }}
                          </label>
                        }
                      </div>
                    }
                    @case ('indices') {
                      <textarea [(ngModel)]="form[f.key]" rows="2" [placeholder]="f.placeholder ?? '0 or 1,2'"></textarea>
                    }
                    @case ('image') {
                      <div class="img-pick">
                        @if (form[f.key]) {
                          <img [src]="form[f.key]" alt="" class="img-pick-thumb" />
                        } @else {
                          <div class="img-pick-thumb empty-thumb">—</div>
                        }
                        <div class="img-pick-body">
                          <span class="img-pick-name">{{ imageFileName(form[f.key]) || 'Not set' }}</span>
                          <div class="img-pick-actions">
                            <button type="button" class="btn btn-sm" (click)="openLibrary(f.key)">Choose Image</button>
                            @if (form[f.key]) {
                              <button type="button" class="btn btn-sm btn-danger" (click)="form[f.key] = ''">Clear</button>
                            }
                          </div>
                        </div>
                      </div>
                    }
                    @case ('options') {
                      <div class="opt-builder">
                        @for (row of asOptions(form[f.key]); track $index) {
                          <div class="opt-row">
                            @if (form['mode'] === 'multi') {
                              <input type="checkbox" [checked]="row.correct" (change)="toggleOptionCorrect(f.key, $index, $any($event.target).checked)" title="Correct answer" />
                            } @else {
                              <input type="radio" [name]="f.key + '-correct'" [checked]="row.correct" (change)="setSingleCorrect(f.key, $index)" title="Correct answer" />
                            }
                            <input type="text" [ngModel]="row.text" (ngModelChange)="setOptionText(f.key, $index, $event)" [ngModelOptions]="{ standalone: true }" [placeholder]="'Option ' + ($index + 1)" />
                            <button type="button" class="opt-remove" (click)="removeOption(f.key, $index)" [disabled]="asOptions(form[f.key]).length <= 2" aria-label="Remove option">✕</button>
                          </div>
                        }
                        <button type="button" class="btn btn-sm" (click)="addOption(f.key)">+ Add option</button>
                      </div>
                    }
                    @default {
                      <input [type]="f.type === 'email' ? 'email' : 'text'" [(ngModel)]="form[f.key]" [placeholder]="f.placeholder ?? ''" />
                    }
                  }
                  @if (f.help) {
                    <div class="hint">{{ f.help }}</div>
                  }
                </div>
              }
            </div>
            }
          </div>
          <div class="m-foot">
            <button class="btn" (click)="closeModal()">Cancel</button>
            <button class="btn btn-gold" [disabled]="saving" (click)="submit()">
              {{ saving ? 'Saving…' : editing ? 'Save changes' : 'Create' }}
            </button>
          </div>
        </div>
      </div>
    }

    @if (libraryField) {
      <app-media-library-modal
        [folder]="cfg.mod"
        (selected)="onImageSelected($event)"
        (close)="libraryField = null"
      />
    }

    @if (viewOpen) {
      <div class="modal-root" (click)="closeView()">
        <div class="modal wide" (click)="$event.stopPropagation()">
          <div class="m-head">
            <h3>{{ viewTitle }}</h3>
            <button class="m-x" (click)="closeView()">✕</button>
          </div>
          <div class="m-body">
            @if (viewError) {
              <div class="err">{{ viewError }}</div>
            }
            @if (viewData) {
              <dl class="dl">
                @for (f of viewFields(); track f.key) {
                  <dt>{{ f.label }}</dt>
                  <dd>{{ f.value }}</dd>
                }
              </dl>
              @if (students().length) {
                <h4 class="sec">Students</h4>
                <table class="mini">
                  <thead><tr><th>Code</th><th>Name</th><th>Grade</th><th>Reg</th><th>Status</th></tr></thead>
                  <tbody>
                    @for (st of students(); track st['id']) {
                      <tr>
                        <td>{{ st['code'] }}</td>
                        <td class="b">{{ st['name'] }}</td>
                        <td>{{ st['grade'] }}</td>
                        <td>{{ studentRegs(st) }}</td>
                        <td>{{ studentStatus(st) }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              }
              @if (payments().length) {
                <h4 class="sec">Payments</h4>
                <table class="mini">
                  <thead><tr><th>Code</th><th>Stage</th><th>Amount</th><th>Mode</th><th>Status</th></tr></thead>
                  <tbody>
                    @for (p of payments(); track p['id']) {
                      <tr>
                        <td>{{ p['code'] }}</td>
                        <td>{{ stageName(p) }}</td>
                        <td>₹{{ p['amount'] }}</td>
                        <td>{{ p['mode'] }}</td>
                        <td><span class="bdg" [ngClass]="badgeClass({ badgeMap: { Paid: 'green', Pending: 'gold', Failed: 'red' } }, p['status'])">{{ p['status'] }}</span></td>
                      </tr>
                    }
                  </tbody>
                </table>
              }
            } @else {
              <div class="empty">Loading…</div>
            }
          </div>
          <div class="m-foot">
            <button class="btn" (click)="closeView()">Close</button>
          </div>
        </div>
      </div>
    }

    @if (bulkOpen) {
      <div class="modal-root" (click)="closeBulk()">
        <div class="modal wide" (click)="$event.stopPropagation()">
          <div class="m-head">
            <h3>Bulk Upload — {{ cfg.title }}</h3>
            <button class="m-x" (click)="closeBulk()">✕</button>
          </div>
          <div class="m-body">
            @if (bulkError) {
              <div class="err">{{ bulkError }}</div>
            }
            <p class="hint">
              Upload a CSV file to add many at once.
              <a href="javascript:void(0)" (click)="downloadSample()">Download the sample CSV</a>
              to see the expected columns.
            </p>
            <div class="f">
              <label>CSV file</label>
              <input type="file" accept=".csv,text/csv" (change)="onFileSelected($event)" />
              @if (bulkFile) {
                <div class="hint">Selected: {{ bulkFile.name }} ({{ bulkFileSizeKb() }} KB)</div>
              }
            </div>
            @if (bulkResult) {
              <div class="bulk-summary">
                <span class="bdg green">{{ bulkResult.created }} created</span>
                @if (bulkResult.failed) {
                  <span class="bdg red">{{ bulkResult.failed }} failed</span>
                }
                <span class="bdg grey">{{ bulkResult.total }} row{{ bulkResult.total === 1 ? '' : 's' }} in file</span>
              </div>
              @if (bulkResult.errors.length) {
                <div class="bulk-errors-wrap">
                  <table class="mini">
                    <thead><tr><th>Row</th><th>Issue</th></tr></thead>
                    <tbody>
                      @for (e of bulkResult.errors; track e.row) {
                        <tr><td>{{ e.row }}</td><td>{{ e.message }}</td></tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            }
          </div>
          <div class="m-foot">
            <button class="btn" (click)="closeBulk()">Close</button>
            <button class="btn btn-gold" [disabled]="!bulkFile || bulkUploading" (click)="uploadBulk()">
              {{ bulkUploading ? 'Uploading…' : 'Upload' }}
            </button>
          </div>
        </div>
      </div>
    }

    @if (linkModalUrl) {
      <div class="modal-root" (click)="linkModalUrl = null">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="m-head">
            <h3>Login Link</h3>
            <button class="m-x" (click)="linkModalUrl = null">✕</button>
          </div>
          <div class="m-body">
            <p class="hint">Already copied to your clipboard — here it is again in case you need to grab it a second time.</p>
            <div class="f">
              <input type="text" readonly [value]="linkModalUrl" (click)="$any($event.target).select()" style="font-family:monospace;font-size:0.82rem" />
            </div>
          </div>
          <div class="m-foot">
            <button class="btn" (click)="linkModalUrl = null">Close</button>
            <button class="btn btn-gold" (click)="copyLinkAgain()">Copy</button>
          </div>
        </div>
      </div>
    }

    @if (promptAction) {
      <div class="modal-root" (click)="promptAction = null">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="m-head">
            <h3>{{ promptAction.action.label }}</h3>
            <button class="m-x" (click)="promptAction = null">✕</button>
          </div>
          <div class="m-body">
            @if (promptError) {
              <div class="err">{{ promptError }}</div>
            }
            <div class="f">
              <label>{{ promptAction.action.inputPrompt!.label }}</label>
              <input
                type="text"
                [(ngModel)]="promptValue"
                (keydown.enter)="submitPrompt()"
                autocomplete="off"
                style="font-family:monospace"
              />
              @if (promptAction.action.inputPrompt!.help) {
                <div class="hint">{{ promptAction.action.inputPrompt!.help }}</div>
              }
            </div>
          </div>
          <div class="m-foot">
            <button class="btn" (click)="promptAction = null" [disabled]="promptBusy">Cancel</button>
            <button class="btn btn-gold" (click)="submitPrompt()" [disabled]="promptBusy">
              {{ promptBusy ? 'Saving…' : promptAction.action.label }}
            </button>
          </div>
        </div>
      </div>
    }

    @if (loginLinkAction(); as la) {
      <div class="modal-root" (click)="closeLoginLink()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="m-head">
            <h3>Magic Link — {{ la.row['name'] ?? la.row['code'] }}</h3>
            <button class="m-x" (click)="closeLoginLink()">✕</button>
          </div>
          <div class="m-body">
            <p class="hint">
              Generates a one-click sign-in link for this school's portal — anyone who opens it is signed in without a password or OTP.
              It expires in 7 days, and stops working as soon as the school's password is set or changed.
            </p>
            @if (loginLinkError()) {
              <div class="err">{{ loginLinkError() }}</div>
            }
            <div class="f">
              <label>Sign in as</label>
              <label class="chk" style="display:flex;gap:0.5rem;align-items:center;font-weight:600;color:var(--text,#eef2fb);margin-bottom:0.4rem">
                <input type="radio" name="loginAs" value="admin" [ngModel]="loginLinkAs()" (ngModelChange)="setLoginLinkAs($event)" style="width:auto" />
                School admin login
              </label>
              <label class="chk" style="display:flex;gap:0.5rem;align-items:center;font-weight:600;color:var(--text,#eef2fb)">
                <input type="radio" name="loginAs" value="coordinator" [ngModel]="loginLinkAs()" (ngModelChange)="setLoginLinkAs($event)" style="width:auto" />
                Coordinator login
              </label>
              <div class="hint">A school has a single portal account today, so both options open the same account.</div>
            </div>
            @if (loginLinkResult(); as res) {
              <div class="sec">Link ({{ res.loginAs === 'admin' ? 'School admin' : 'Coordinator' }})</div>
              <div class="f">
                <input type="text" readonly [value]="res.loginUrl" (focus)="$any($event.target).select()" style="font-family:monospace;font-size:0.78rem" />
                <div class="hint">Expires {{ res.expiresAt.slice(0, 10) }}. Copied to your clipboard.</div>
              </div>
            }
          </div>
          <div class="m-foot">
            <button class="btn" (click)="closeLoginLink()">Close</button>
            @if (loginLinkResult()) {
              <button class="btn" (click)="copyLoginLink()">Copy again</button>
            }
            <button class="btn btn-gold" [disabled]="loginLinkBusy()" (click)="generateLoginLink()">
              {{ loginLinkBusy() ? 'Generating…' : loginLinkResult() ? 'Regenerate' : 'Generate link' }}
            </button>
          </div>
        </div>
      </div>
    }

    @if (mergeAction(); as ma) {
      <div class="modal-root" (click)="closeMerge()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="m-head">
            <h3>Merge into another {{ ma.action.merge!.noun }}</h3>
            <button class="m-x" (click)="closeMerge()">✕</button>
          </div>
          <div class="m-body">
            <p class="hint">
              <strong>{{ mergeRowKey(ma.row) }}</strong> will be merged into the {{ ma.action.merge!.noun }} you choose below.
              @if (ma.action.merge!.noun === 'school') {
                Its students and broadcast history move to the target; this record is then deleted. The target's own login, coordinator and verification status are never changed.
              } @else {
                Its registrations move to the target wherever it doesn't already have one for that competition; this record is deleted only if nothing is left behind. The target's own name/grade/login are never changed.
              }
            </p>
            @if (mergeError()) {
              <div class="err">{{ mergeError() }}</div>
            }
            <div class="f">
              <label>{{ ma.action.merge!.noun === 'school' ? 'School' : 'Student' }} to keep — search by name or code</label>
              <input
                type="text"
                [(ngModel)]="mergeTargetCode"
                (ngModelChange)="onMergeTargetInput()"
                (keydown.enter)="fetchMergePreview()"
                autocomplete="off"
                placeholder="{{ ma.action.merge!.noun === 'school' ? 'e.g. Viraj Khand or S177' : 'e.g. student name or R1074' }}"
              />
              @if (mergeResults().length) {
                <div class="merge-results">
                  @for (r of mergeResults(); track r.code) {
                    <button type="button" (click)="pickMergeTarget(r)">
                      <b>{{ r.code }}</b> — {{ r.label }}
                    </button>
                  }
                </div>
              }
            </div>
            <button class="btn" [disabled]="!mergeTargetCode.trim() || mergePreviewBusy()" (click)="fetchMergePreview()">
              {{ mergePreviewBusy() ? 'Checking…' : 'Preview' }}
            </button>

            @if (mergePreview(); as p) {
              <div class="sec">Preview</div>
              @if (ma.action.merge!.noun === 'school') {
                <dl class="dl">
                  <dt>Keep</dt>
                  <dd>
                    {{ p.keep.code }} — {{ p.keep.name }}
                    <span class="bdg" [ngClass]="p.keep.verified ? 'green' : 'gold'">{{ p.keep.verified ? 'Verified' : 'Unverified' }}</span>
                  </dd>
                  <dt>Merge away</dt>
                  <dd>{{ p.merge.code }} — {{ p.merge.name }}</dd>
                  <dt>Students to move</dt>
                  <dd>{{ p.studentsToMove ?? 0 }}</dd>
                  <dt>Paid registrations</dt>
                  <dd>{{ p.paidRegistrationsToMove ?? 0 }}</dd>
                </dl>
              } @else {
                <dl class="dl">
                  <dt>Keep</dt>
                  <dd>{{ p.keep.code }} — {{ p.keep.name }} (Grade {{ p.keep.grade }})</dd>
                  <dt>Merge away</dt>
                  <dd>{{ p.merge.code }} — {{ p.merge.name }} (Grade {{ p.merge.grade }})</dd>
                  <dt>Registrations to move</dt>
                  <dd>{{ p.movable ?? 0 }}</dd>
                </dl>
                @if (p.conflicts && p.conflicts.length) {
                  <div class="err">
                    {{ p.conflicts.length }} registration(s) can't move automatically — {{ p.keep.code }} already has one in the same competition. These stay on {{ p.merge.code }}; resolve manually from the Registrations list first if you need them combined too.
                    <ul style="margin:0.4rem 0 0 1.1rem">
                      @for (c of p.conflicts; track c.code) {
                        <li>{{ c.code }} — {{ c.competitionTitle }}</li>
                      }
                    </ul>
                  </div>
                }
              }
            }
          </div>
          <div class="m-foot">
            <button class="btn" (click)="closeMerge()" [disabled]="mergeBusy()">Cancel</button>
            <button class="btn btn-gold" [disabled]="!mergePreview() || mergeBusy()" (click)="confirmMerge()">
              {{ mergeBusy() ? 'Merging…' : 'Confirm Merge' }}
            </button>
          </div>
        </div>
      </div>
    }

    @if (toast) {
      <div class="toast">{{ toast }}</div>
    }
  `,
  styles: [ADMIN_UI_CSS],
})
export class AdminCrudPage {
  private readonly api = inject(ApiService);
  // Plain (non-signal) field writes made from inside an async callback —
  // an HTTP .subscribe() being the common case — aren't reliably picked
  // up by Angular's scheduler on their own (see the same note on
  // provideZoneChangeDetection in app.config.ts); postRowAction() below
  // explicitly requests a check after such a write so e.g. this modal
  // actually closes the moment its request resolves, not whenever some
  // unrelated re-render happens to sweep it up.
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly route = inject(ActivatedRoute);

  readonly cfg: CrudConfig;
  private readonly refs = new Map<string, string[]>();
  private readonly competitionTitles = new Map<string, string>();
  // A select's OPTION VALUE has to stay the bare code (schoolCode etc. is
  // what's actually saved, and what an existing row's field already holds
  // — using a combined "code — name" string as the value broke both: the
  // select couldn't match a loaded row's plain code against any option
  // (showing blank until you picked one yourself), and picking one then
  // saved the whole combined string into a column with a 10-char limit).
  // These hold the separate, code-keyed DISPLAY label for those two refs.
  private readonly schoolLabels = new Map<string, string>();
  private readonly registrationLabels = new Map<string, string>();

  readonly rows = signal<Row[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly limit = 15;
  search = '';
  filters: Record<string, string> = {};
  error = '';

  // Row actions "3 dots" menu — see .kebab-* in ADMIN_UI_CSS. Positioned
  // via computed fixed coordinates (menuPos), not the CSS's own
  // position:absolute default, so it renders above .tbl-wrap's
  // overflow:auto instead of being clipped by it — see toggleMenu().
  readonly openMenuFor = signal<string | null>(null);
  protected readonly menuPos = signal<{ top?: number; bottom?: number; right: number } | null>(null);

  // Closes the kebab menu on any click outside it — the button and the
  // menu itself both stop propagation, so this only ever fires for a
  // genuine outside click.
  @HostListener('document:click')
  protected closeMenu(): void {
    this.openMenuFor.set(null);
    this.menuPos.set(null);
  }

  protected rowKey(row: Row): string {
    return `${row[this.cfg.keyField ?? 'code'] ?? ''}`;
  }

  // Computes viewport-fixed coordinates from the clicked button's own
  // position, rather than letting the menu sit position:absolute inside
  // .tbl-wrap (which clips anything extending past its bottom edge once
  // overflow:auto is set for horizontal scrolling — see ADMIN_UI_CSS).
  // Anchored by `right` (distance from the viewport's right edge) rather
  // than `left`, so the menu's right edge lines up with the button's,
  // matching the original absolute-positioned look, regardless of the
  // menu's own rendered width.
  protected toggleMenu(key: string, event: MouseEvent): void {
    if (this.openMenuFor() === key) {
      this.closeMenu();
      return;
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const right = window.innerWidth - rect.right;
    // Flip upward when the row is near the bottom of the viewport — a
    // full menu (View/Edit/rowActions/Archive/Delete) can run to ~280px,
    // so anything short of that below the button would clip it against
    // the viewport edge (see the screenshot that prompted this: a row
    // near the bottom showed only the first two items). No need to
    // measure the actual menu — it hasn't rendered yet at click time —
    // this fixed estimate covers the largest menu this app has.
    const estimatedMenuHeight = 280;
    const spaceBelow = window.innerHeight - rect.bottom;
    this.menuPos.set(
      spaceBelow < estimatedMenuHeight
        ? { bottom: window.innerHeight - rect.top + 4, right }
        : { top: rect.bottom + 4, right },
    );
    this.openMenuFor.set(key);
  }

  modalOpen = false;
  editing = false;
  saving = false;
  modalError = '';
  editingKey = '';
  form: Record<string, unknown> = {};
  toast = '';
  libraryField: string | null = null;

  viewOpen = false;
  viewData: Row | null = null;
  viewError = '';
  viewTitle = '';
  editMode: 'main' | 'profile' = 'main';
  // While a profile record is being fetched, the form is hidden entirely
  // rather than shown with its (still-default) blank field values — a
  // brief "populated with nothing" flash otherwise reads as a broken form.
  profileLoading = signal(false);

  bulkOpen = false;
  bulkFile: File | null = null;
  bulkUploading = false;
  bulkError = '';
  bulkResult: BulkUploadResult | null = null;

  exportBusy = false;

  constructor() {
    const mod = (this.route.snapshot.data['mod'] as string) ?? '';
    this.cfg = CRUD_MODULES[mod] ?? CRUD_MODULES['ann'];
    this.loadRefs();
    this.load();
  }

  min(a: number, b: number) {
    return Math.min(a, b);
  }

  isoDate(v: unknown) {
    return isoDate(v);
  }

  // Was a raw string slice of the ISO value until 2026-09-11 — that reads
  // the UTC wall-clock digits straight off the wire with no conversion at
  // all, so every "datetime" column (Registered, Paid, Received, Sent)
  // was showing times 5.5h behind actual IST. Format explicitly in IST
  // instead of trusting the viewer's own device timezone, since every
  // admin using this table is looking at an India-only platform.
  datetime(v: unknown) {
    if (typeof v !== 'string') return '';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
  }

  timeStr(v: unknown) {
    if (typeof v !== 'string') return '';
    const m = v.match(/(\d{1,2}):(\d{2})/);
    return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
  }

  timeParts(key: string) {
    const v = typeof this.form[key] === 'string' ? (this.form[key] as string) : '';
    const m = v.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return { h: '8', m: '00', ap: 'AM' };
    const h24 = Number(m[1]);
    const ap = h24 >= 12 ? 'PM' : 'AM';
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return { h: String(h12), m: m[2], ap };
  }

  timeHours(key: string) {
    return this.timeParts(key).ap === 'AM' ? ['8', '9', '10', '11'] : ['12', '1', '2', '3', '4', '5', '6'];
  }

  timeMinutes() {
    return ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];
  }

  setTime(key: string, part: 'h' | 'm' | 'ap', value: string) {
    const t = this.timeParts(key);
    if (part === 'h') t.h = value;
    else if (part === 'm') t.m = value;
    else t.ap = value;
    let h24 = Number(t.h) % 12;
    if (t.ap === 'PM') h24 += 12;
    this.form[key] = `${String(h24).padStart(2, '0')}:${t.m}`;
  }

  arrayText(v: unknown) {
    return Array.isArray(v) ? v.join(', ') : '';
  }

  /** Strips HTML tags for a plain-text list preview of a richtext field
   * (e.g. a question's formatted prompt) — the list row just needs a
   * readable snippet, not the actual formatting. */
  plainText(v: unknown) {
    const s = typeof v === 'string' ? v : '';
    return s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || '—';
  }

  badgeClass(c: { badgeMap?: Record<string, string> }, value: unknown) {
    const map = c.badgeMap ?? {};
    return map[String(value)] ?? 'grey';
  }

  filterOptions(f: { options?: string[]; ref?: 'competitions' | 'grades' | 'question-categories' | 'schools' }) {
    if (f.ref === 'competitions') return this.refs.get('competitions') ?? [];
    if (f.ref === 'grades') return this.refs.get('grades') ?? [];
    if (f.ref === 'question-categories') return this.refs.get('question-categories') ?? [];
    if (f.ref === 'schools') return this.refs.get('schools') ?? [];
    return f.options ?? [];
  }

  /** Display text for one filter option — the value stays the raw code
   * (that's what's actually filtered on), but a competition/school shows
   * its real name instead of a bare code like "C1"/"S10". */
  filterLabel(f: { ref?: 'competitions' | 'grades' | 'question-categories' | 'schools' }, opt: string): string {
    if (f.ref === 'competitions') return this.competitionTitles.get(opt) ?? opt;
    if (f.ref === 'schools') return this.schoolLabels.get(opt) ?? opt;
    return opt;
  }

  fieldOptions(f: FieldDef) {
    if (f.ref === 'competitions') return this.refs.get('competitions') ?? [];
    if (f.ref === 'schools') return this.refs.get('schools') ?? [];
    if (f.ref === 'registrations') return this.refs.get('registrations') ?? [];
    if (f.ref === 'grades') return this.refs.get('grades') ?? [];
    if (f.ref === 'question-categories') return this.refs.get('question-categories') ?? [];
    return f.options ?? [];
  }

  /** Display text for one field option — the option's VALUE (what's
   * actually saved) stays the bare code; this is purely what the admin
   * reads in the dropdown. */
  fieldOptionLabel(f: FieldDef, opt: string): string {
    if (f.ref === 'competitions') return this.competitionTitles.get(opt) ?? opt;
    if (f.ref === 'schools') return this.schoolLabels.get(opt) ?? opt;
    if (f.ref === 'registrations') return this.registrationLabels.get(opt) ?? opt;
    return opt;
  }

  formFields(): FieldDef[] {
    const fields = this.editMode === 'profile' ? (this.cfg.profile?.fields ?? []) : this.cfg.fields;
    if (!this.editing) return fields.filter((f) => f.type !== 'password' || !f.editOnly);
    return fields.filter((f) => !(f.type === 'password' && f.editOnly));
  }

  applySearch() {
    this.page.set(1);
    this.load();
  }

  setFilter(key: string, value: string) {
    this.filters[key] = value;
    this.page.set(1);
    this.load();
  }

  go(p: number) {
    this.page.set(p);
    this.load();
  }

  // Same search/filter values as the current list view, minus
  // page/limit — the export endpoint returns every matching row in one
  // file rather than a page at a time.
  exportXlsx() {
    const cfg = this.cfg.export;
    if (!cfg || this.exportBusy) return;
    const p: Record<string, unknown> = {};
    if (this.search.trim()) p['search'] = this.search.trim();
    for (const [k, v] of Object.entries(this.filters)) {
      if (v) p[k] = v;
    }
    this.exportBusy = true;
    this.api.downloadBlob(cfg.url, p).subscribe({
      next: (blob) => {
        this.exportBusy = false;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = cfg.filename;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: (e) => {
        this.exportBusy = false;
        this.showToast(errText(e));
      },
    });
  }

  private params(): Record<string, unknown> {
    const p: Record<string, unknown> = { page: this.page(), limit: this.limit };
    if (this.search.trim()) p['search'] = this.search.trim();
    for (const [k, v] of Object.entries(this.filters)) {
      if (v) p[k] = v;
    }
    return p;
  }

  private loadRefs() {
    const wanted = new Set<string>();
    for (const f of this.cfg.fields ?? []) if (f.ref) wanted.add(f.ref);
    for (const f of this.cfg.profile?.fields ?? []) if (f.ref) wanted.add(f.ref);
    for (const f of this.cfg.filters ?? []) if (f.ref) wanted.add(f.ref);
    if (wanted.has('competitions')) {
      this.api.get<ListResult>('/competitions', { limit: 100 }).subscribe({
        next: (r) => {
          const opts = (r.data ?? []).map((c) => `${c['code']}`).sort();
          this.refs.set('competitions', opts);
          // Codes stay the actual filter/field VALUE (matches what the API
          // expects and what's already stored on existing rows) — this is
          // just for display, so the "Competition" filter shows a real
          // name instead of a bare code like "C1".
          for (const c of r.data ?? []) this.competitionTitles.set(`${c['code']}`, `${c['title'] ?? c['code']}`);
        },
        error: () => undefined,
      });
    }
    if (wanted.has('schools')) {
      // 500 = ListQueryDto's own max — comfortably above the real school
      // count (a couple hundred), so the School filter/dropdown always
      // shows every school rather than silently truncating at 100.
      this.api.get<ListResult>('/schools', { limit: 500 }).subscribe({
        next: (r) => {
          // The option VALUE is the bare code — that's what's stored on a
          // student and what the backend accepts (schoolCode is limited to
          // 10 chars). The name-only label is shown separately (see
          // fieldOptionLabel) per the request to drop the "S10 — " prefix
          // from the dropdown text.
          const opts = (r.data ?? []).map((s) => `${s['code']}`);
          this.refs.set('schools', opts);
          for (const s of r.data ?? []) this.schoolLabels.set(`${s['code']}`, `${s['name'] ?? s['code']}`);
        },
        error: () => undefined,
      });
    }
    if (wanted.has('registrations')) {
      this.api.get<ListResult>('/registrations', { limit: 500 }).subscribe({
        next: (r) => {
          const opts = (r.data ?? []).map((x) => `${x['code']}`);
          this.refs.set('registrations', opts);
          for (const x of r.data ?? []) this.registrationLabels.set(`${x['code']}`, `${x['code']} — ${x['name']}`);
        },
        error: () => undefined,
      });
    }
    if (wanted.has('grades')) {
      this.api.get<ListResult>('/grades', { limit: 100 }).subscribe({
        next: (r) => {
          const opts = (r.data ?? [])
            .map((g) => `${g['name']}`)
            .filter(Boolean)
            .sort();
          this.refs.set('grades', opts);
        },
        error: () => undefined,
      });
    }
    if (wanted.has('question-categories')) {
      this.api.get<ListResult>('/question-categories', { limit: 100 }).subscribe({
        next: (r) => {
          const opts = (r.data ?? []).map((c) => `${c['name']}`).filter(Boolean);
          this.refs.set('question-categories', opts);
        },
        error: () => undefined,
      });
    }
  }

  private load() {
    this.error = '';
    const obs = (this.cfg.paginated === false
      ? this.api.get<Row[]>(this.cfg.base, this.params())
      : this.api.get<ListResult>(this.cfg.base, this.params())) as Observable<
      Row[] | ListResult
    >;
    obs.subscribe({
      next: (r) => {
        if (Array.isArray(r)) {
          this.rows.set(r as Row[]);
          this.total.set((r as Row[]).length);
        } else {
          const res = r as ListResult;
          this.rows.set(res.data ?? []);
          this.total.set(res.total ?? 0);
        }
      },
      error: (e) => {
        this.error = errText(e);
      },
    });
  }

  private resetForm(fields?: FieldDef[]) {
    const list = fields ?? this.cfg.fields;
    this.form = {};
    for (const f of list) {
      if (f.type === 'checkbox') this.form[f.key] = f.defaultChecked ?? false;
      else if (f.type === 'checklist') this.form[f.key] = [];
      else if (f.type === 'lines' || f.type === 'indices') this.form[f.key] = '';
      // Start a fresh options builder with two blank rows rather than empty,
      // so there's something to type into immediately.
      else if (f.type === 'options') this.form[f.key] = [{ text: '', correct: false }, { text: '', correct: false }];
      else this.form[f.key] = f.type === 'select' ? '' : '';
    }
  }

  openCreate() {
    this.editMode = 'main';
    this.resetForm();
    this.editing = false;
    this.editingKey = '';
    this.modalError = '';
    this.modalOpen = true;
  }

  openEdit(row: Row) {
    this.editMode = 'main';
    this.resetForm();
    this.editing = true;
    this.editingKey = `${row[this.cfg.keyField ?? 'code'] ?? ''}`;
    for (const f of this.cfg.fields) {
      const v = row[f.key];
      if (f.type === 'date') this.form[f.key] = isoDate(v);
      else if (f.type === 'time') this.form[f.key] = this.timeStr(v);
      else if (f.type === 'lines') this.form[f.key] = Array.isArray(v) ? v.join('\n') : '';
      else if (f.type === 'checklist') this.form[f.key] = Array.isArray(v) ? [...v] : [];
      else if (f.type === 'indices') this.form[f.key] = Array.isArray(v) ? v.join(',') : '';
      else if (f.type === 'options') this.form[f.key] = this.zipOptions(v, row['correct']);
      else if (f.type === 'number') this.form[f.key] = v;
      else if (f.type === 'checkbox') this.form[f.key] = !!v;
      else this.form[f.key] = v ?? '';
    }
    this.modalError = '';
    this.modalOpen = true;
  }

  protected asChecklist(v: unknown): string[] {
    return Array.isArray(v) ? (v as string[]) : [];
  }

  protected toggleChecklist(key: string, value: string, e: Event): void {
    const checked = (e.target as HTMLInputElement).checked;
    const current = this.asChecklist(this.form[key]);
    this.form[key] = checked ? [...current, value] : current.filter((v) => v !== value);
  }

  /** Rebuilds the options-builder's {text, correct}[] shape from the API's separate options[]/correct[] arrays. */
  private zipOptions(options: unknown, correct: unknown): { text: string; correct: boolean }[] {
    const opts = Array.isArray(options) ? (options as string[]) : [];
    const correctSet = new Set(Array.isArray(correct) ? (correct as number[]) : []);
    const rows = opts.map((text, i) => ({ text, correct: correctSet.has(i) }));
    return rows.length ? rows : [{ text: '', correct: false }, { text: '', correct: false }];
  }

  openEditProfile(row: Row) {
    if (!this.cfg.profile) return;
    this.editMode = 'profile';
    this.resetForm(this.cfg.profile.fields);
    this.editing = true;
    this.editingKey = `${row[this.cfg.keyField ?? 'code'] ?? ''}`;
    this.modalError = '';
    this.modalOpen = true;
    this.profileLoading.set(true);
    this.api.get<Row>(`${this.cfg.profile.base}/${this.editingKey}`).subscribe({
      next: (s) => {
        for (const f of this.cfg.profile?.fields ?? []) {
          let v: unknown = s[f.key];
          if (f.key === 'schoolCode') {
            const school = s['school'] as { code?: string } | null | undefined;
            v = school?.code ?? '';
          }
          if (f.type === 'date') this.form[f.key] = isoDate(v);
          else if (f.type === 'number') this.form[f.key] = v;
          else if (f.type === 'checkbox') this.form[f.key] = !!v;
          else this.form[f.key] = v ?? '';
        }
        this.profileLoading.set(false);
      },
      error: (e) => {
        this.modalError = errText(e);
        this.profileLoading.set(false);
      },
    });
  }

  closeModal() {
    if (this.saving) return;
    this.modalOpen = false;
  }

  openLibrary(field: string) {
    this.libraryField = field;
  }

  onImageSelected(url: string) {
    if (this.libraryField) this.form[this.libraryField] = url;
    this.libraryField = null;
  }

  imageFileName(url: unknown): string {
    if (typeof url !== 'string' || !url) return '';
    const clean = url.split('?')[0];
    return clean.split('/').pop() ?? clean;
  }

  asOptions(v: unknown): { text: string; correct: boolean }[] {
    return Array.isArray(v) ? (v as { text: string; correct: boolean }[]) : [];
  }

  addOption(key: string) {
    this.form[key] = [...this.asOptions(this.form[key]), { text: '', correct: false }];
  }

  removeOption(key: string, index: number) {
    const rows = this.asOptions(this.form[key]);
    if (rows.length <= 2) return; // keep at least two options
    this.form[key] = rows.filter((_, i) => i !== index);
  }

  setOptionText(key: string, index: number, text: string) {
    this.form[key] = this.asOptions(this.form[key]).map((r, i) => (i === index ? { ...r, text } : r));
  }

  /** Multi-answer mode: toggle just this row's correctness independently. */
  toggleOptionCorrect(key: string, index: number, checked: boolean) {
    this.form[key] = this.asOptions(this.form[key]).map((r, i) => (i === index ? { ...r, correct: checked } : r));
  }

  /** Single-answer mode: exactly one option can be correct at a time. */
  setSingleCorrect(key: string, index: number) {
    this.form[key] = this.asOptions(this.form[key]).map((r, i) => ({ ...r, correct: i === index }));
  }

  private payload(): Record<string, unknown> {
    const isProfile = this.editMode === 'profile';
    const fields = isProfile ? (this.cfg.profile?.fields ?? []) : this.cfg.fields;
    const out: Record<string, unknown> = {};
    for (const f of fields) {
      const v = this.form[f.key];
      if (f.editOnly && (v === '' || v == null)) continue;
      let val: unknown = v;
      if (f.type === 'number') val = v === '' ? undefined : Number(v);
      else if (f.type === 'lines') {
        val = typeof v === 'string' ? v.split('\n').map((s) => s.trim()).filter(Boolean) : [];
      } else if (f.type === 'indices') {
        val = typeof v === 'string'
          ? v.split(/[,\s]+/).map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n))
          : [];
      }
      if (val === '' || val == null) continue;
      out[f.key] = val;
    }
    // createTransform (e.g. wrapping fields under `student: {...}`) shapes the
    // payload for the MAIN create/edit endpoint only. Profile edits hit a
    // different endpoint (cfg.profile.base) that expects the flat fields
    // as-is — applying it there silently drops every edited field.
    return !isProfile && this.cfg.createTransform ? this.cfg.createTransform(out) : out;
  }

  submit() {
    if (this.saving) return;
    this.saving = true;
    this.modalError = '';
    const body = this.payload();
    const key = this.editingKey;
    const isProfile = this.editMode === 'profile';
    const obs = isProfile
      ? this.api.patch(`${this.cfg.profile!.base}/${key}`, body)
      : this.editing
        ? this.api.patch(`${this.cfg.base}/${key}`, body)
        : this.api.post(this.cfg.createPath ?? this.cfg.base, body);
    obs.subscribe({
      next: () => {
        this.saving = false;
        this.modalOpen = false;
        this.showToast(this.editing ? 'Saved' : 'Created');
        this.load();
      },
      error: (e) => {
        this.saving = false;
        this.modalError = errText(e);
      },
    });
  }

  view(row: Row) {
    const key = `${row[this.cfg.keyField ?? 'code'] ?? ''}`;
    this.viewData = null;
    this.viewError = '';
    this.viewTitle = `${row[this.cfg.columns[0]?.key] ?? key}`;
    this.viewOpen = true;
    this.api.get<Row>(`${this.cfg.base}/${key}`).subscribe({
      next: (d) => {
        this.viewData = d;
      },
      error: (e) => {
        this.viewError = errText(e);
      },
    });
  }

  closeView() {
    this.viewOpen = false;
    this.viewData = null;
  }

  viewFields(): { key: string; label: string; value: string }[] {
    const d = this.viewData;
    if (!d) return [];
    const out: { key: string; label: string; value: string }[] = [];
    const labelFor = (k: string) => this.cfg.columns.find((c) => c.key === k)?.label ?? k;
    const push = (k: string, label: string, v: unknown) => {
      if (v === null || v === undefined || v === '') return;
      out.push({ key: k, label, value: String(v) });
    };
    const names = ['code', 'name', 'email', 'phone', 'grade', 'parent'];
    for (const k of names) push(k, labelFor(k), d[k]);
    const st = d['student'] as Row | null | undefined;
    if (st) {
      for (const k of ['code', 'name', 'email', 'phone', 'grade', 'parent'])
        push(`student.${k}`, k === 'code' ? 'Student code' : labelFor(k), st[k]);
      const school = st['school'] as { name?: string } | null | undefined;
      push('student.school', 'School', school?.name);
    }
    const school = d['school'] as { name?: string } | null | undefined;
    push('school.name', 'School', school?.name);
    const comp = d['competition'] as { title?: string; code?: string } | null | undefined;
    push('competition', 'Competition', comp ? `${comp.title ?? ''}${comp.code ? ` (${comp.code})` : ''}` : null);
    push('status', 'Status', d['status']);
    push('registeredAt', 'Registered', d['registeredAt']);
    push('createdAt', 'Created', d['createdAt']);
    return out;
  }

  studentRegs(st: { registrations?: Array<{ code?: string; competition?: { code?: string } }> }) {
    return (st.registrations ?? []).map((r) => r.code ?? '').join(', ') || '—';
  }

  studentStatus(st: { registrations?: Array<{ status?: string }> }) {
    return (st.registrations ?? []).map((r) => r.status ?? '').join(', ') || '—';
  }

  students(): Row[] {
    const v = this.viewData?.['students'];
    return Array.isArray(v) ? (v as Row[]) : [];
  }

  payments(): Row[] {
    const v = this.viewData?.['payments'];
    return Array.isArray(v) ? (v as Row[]) : [];
  }

  stageName(p: Row): string {
    const stage = p['stage'];
    if (stage && typeof stage === 'object') return String((stage as Row)['name'] ?? '');
    return String(p['stageId'] ?? '');
  }

  openBulk() {
    this.bulkOpen = true;
    this.bulkFile = null;
    this.bulkError = '';
    this.bulkResult = null;
  }

  closeBulk() {
    if (this.bulkUploading) return;
    this.bulkOpen = false;
  }

  onFileSelected(evt: Event) {
    const input = evt.target as HTMLInputElement;
    this.bulkFile = input.files?.[0] ?? null;
    this.bulkResult = null;
    this.bulkError = '';
  }

  bulkFileSizeKb() {
    return this.bulkFile ? Math.ceil(this.bulkFile.size / 1024) : 0;
  }

  downloadSample() {
    const cfg = this.cfg.bulkUpload;
    if (!cfg) return;
    this.bulkError = '';
    this.api.downloadBlob(cfg.sampleUrl).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = cfg.sampleFilename;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: (e) => {
        this.bulkError = errText(e);
      },
    });
  }

  uploadBulk() {
    const cfg = this.cfg.bulkUpload;
    if (!cfg || !this.bulkFile || this.bulkUploading) return;
    this.bulkUploading = true;
    this.bulkError = '';
    this.bulkResult = null;
    this.api.postFile<BulkUploadResult>(cfg.uploadUrl, this.bulkFile).subscribe({
      next: (r) => {
        this.bulkUploading = false;
        this.bulkResult = r;
        if (r.created > 0) {
          this.showToast(`${r.created} record${r.created === 1 ? '' : 's'} added`);
          this.load();
        }
      },
      error: (e) => {
        this.bulkUploading = false;
        this.bulkError = errText(e);
      },
    });
  }

  remove(row: Row) {
    const key = `${row[this.cfg.keyField ?? 'code'] ?? ''}`;
    const label = `${row[this.cfg.columns[0]?.key] ?? key}`;
    const note = this.cfg.deleteNote?.(row);
    if (!window.confirm(`Delete "${label}"?${note ? '\n\n' + note : ''}`)) return;
    this.api.delete(`${this.cfg.base}/${key}`).subscribe({
      next: () => {
        this.showToast('Deleted');
        this.load();
      },
      error: (e) => {
        this.error = errText(e);
      },
    });
  }

  /** Soft-remove — see Student.archived. Nothing is deleted; the row just
   * drops out of the default list (still reachable via the Archived
   * status filter) and its student stops matching future registration
   * lookups or receiving any notification. One-way — there is no
   * unarchive action, so this asks for confirmation up front. */
  archive(row: Row) {
    const key = `${row[this.cfg.keyField ?? 'code'] ?? ''}`;
    const label = `${row[this.cfg.columns[0]?.key] ?? key}`;
    if (!window.confirm(`Archive "${label}"? This removes them from the default list and stops all further emails/SMS to them. This cannot be undone from here.`)) return;
    this.api.post(`${this.cfg.base}/${key}/archive`, {}).subscribe({
      next: () => {
        this.showToast('Archived');
        this.load();
      },
      error: (e) => {
        this.error = errText(e);
      },
    });
  }

  linkModalUrl: string | null = null;

  // Active inputPrompt row-action, if any — see runRowAction() and the
  // prompt modal in the template. Holding the row+action (not just the
  // endpoint) lets submitPrompt() reuse the exact same POST/toast/error
  // logic runRowAction() already has, just with a real body instead of {}.
  promptAction: { row: Row; action: NonNullable<CrudConfig['rowActions']>[number] } | null = null;
  promptValue = '';
  promptError = '';
  promptBusy = false;

  /** Generic handler for cfg.rowActions — see crud.config.ts. */
  runRowAction(row: Row, action: NonNullable<CrudConfig['rowActions']>[number]): void {
    if (action.inputPrompt) {
      // The modal's own Cancel/Submit is the confirmation step — skip any
      // separate confirmText/window.confirm for these.
      this.promptValue = '';
      this.promptError = '';
      this.promptAction = { row, action };
      return;
    }
    if (action.confirmText && !window.confirm(action.confirmText)) return;
    this.postRowAction(row, action, {});
  }

  submitPrompt(): void {
    if (!this.promptAction) return;
    const { row, action } = this.promptAction;
    const prompt = action.inputPrompt!;
    const value = this.promptValue.trim();
    if (!value || (prompt.minLength && value.length < prompt.minLength)) {
      this.promptError = `Must be at least ${prompt.minLength ?? 1} characters.`;
      return;
    }
    this.promptBusy = true;
    this.promptError = '';
    this.postRowAction(row, action, { [prompt.field]: value }, () => {
      this.promptBusy = false;
      this.promptAction = null;
    });
  }

  private postRowAction(
    row: Row,
    action: NonNullable<CrudConfig['rowActions']>[number],
    body: Record<string, unknown>,
    onSettled?: () => void,
  ): void {
    const key = `${row[this.cfg.keyField ?? 'code'] ?? ''}`;
    this.api.post<Record<string, unknown>>(`${this.cfg.base}/${key}/${action.endpoint}`, body).subscribe({
      next: (res) => {
        const copyValue = action.copyField ? res?.[action.copyField] : undefined;
        if (typeof copyValue === 'string') {
          navigator.clipboard?.writeText(copyValue).catch(() => {
            /* clipboard access denied — the modal below still shows it either way */
          });
          this.linkModalUrl = copyValue;
        }
        this.showToast(action.successText ?? 'Done');
        onSettled?.();
        this.cdr.markForCheck();
      },
      error: (e) => {
        if (action.inputPrompt) {
          // Keep the modal open on failure (e.g. a rejected password) so
          // the admin can just fix it and resubmit — onSettled() is what
          // closes the modal, so it's deliberately not called here.
          this.promptError = errText(e);
          this.promptBusy = false;
        } else {
          this.error = errText(e);
          onSettled?.();
        }
        this.cdr.markForCheck();
      },
    });
  }

  copyLinkAgain(): void {
    if (this.linkModalUrl) navigator.clipboard?.writeText(this.linkModalUrl);
  }

  // ---- merge modal — see crud.config.ts's rowActions[].merge and
  // RegistrationService.mergeSchools()/mergeStudents(). The clicked row is
  // always the duplicate being absorbed; mergeTargetCode is what the admin
  // types in as the record to keep. Preview must succeed before Confirm
  // enables, so nothing merges on a typo'd/nonexistent target code. ----
  readonly mergeAction = signal<{ row: Row; action: NonNullable<CrudConfig['rowActions']>[number] } | null>(null);
  mergeTargetCode = '';
  readonly mergePreview = signal<MergePreviewResult | null>(null);
  readonly mergePreviewBusy = signal(false);
  readonly mergeBusy = signal(false);
  readonly mergeError = signal('');

  mergeRowKey(row: Row): string {
    const key = `${row[this.cfg.keyField ?? 'code'] ?? ''}`;
    const name = row['name'] ?? row['title'];
    return name ? `${key} — ${name}` : key;
  }

  // ---- Magic Link popup — see crud.config.ts rowActions[].loginLink and
  // RegistrationService.generateSchoolLoginLink(). Changing the radio
  // clears any link already shown, so the copied URL always matches the
  // option currently selected. ----
  readonly loginLinkAction = signal<{ row: Row; action: NonNullable<CrudConfig['rowActions']>[number] } | null>(null);
  readonly loginLinkAs = signal<'admin' | 'coordinator'>('coordinator');
  readonly loginLinkResult = signal<{ loginUrl: string; expiresAt: string; loginAs: 'admin' | 'coordinator' } | null>(null);
  readonly loginLinkBusy = signal(false);
  readonly loginLinkError = signal('');

  openLoginLink(row: Row, action: NonNullable<CrudConfig['rowActions']>[number]): void {
    this.loginLinkAs.set('coordinator');
    this.loginLinkResult.set(null);
    this.loginLinkError.set('');
    this.loginLinkAction.set({ row, action });
  }

  closeLoginLink(): void {
    this.loginLinkAction.set(null);
  }

  setLoginLinkAs(v: 'admin' | 'coordinator'): void {
    this.loginLinkAs.set(v);
    this.loginLinkResult.set(null);
    this.loginLinkError.set('');
  }

  generateLoginLink(): void {
    const la = this.loginLinkAction();
    if (!la || this.loginLinkBusy()) return;
    const key = `${la.row[this.cfg.keyField ?? 'code'] ?? ''}`;
    this.loginLinkBusy.set(true);
    this.loginLinkError.set('');
    this.api
      .post<{ loginUrl: string; expiresAt: string; loginAs: 'admin' | 'coordinator' }>(
        `${this.cfg.base}/${key}/${la.action.endpoint}`,
        { loginAs: this.loginLinkAs() },
      )
      .subscribe({
        next: (r) => {
          this.loginLinkBusy.set(false);
          this.loginLinkResult.set(r);
          navigator.clipboard?.writeText(r.loginUrl).catch(() => undefined);
          this.cdr.markForCheck();
        },
        error: (e) => {
          this.loginLinkBusy.set(false);
          this.loginLinkError.set(errText(e));
          this.cdr.markForCheck();
        },
      });
  }

  copyLoginLink(): void {
    const r = this.loginLinkResult();
    if (r) navigator.clipboard?.writeText(r.loginUrl);
  }

  readonly mergeResults = signal<{ code: string; label: string }[]>([]);
  private mergeSearchTimer: ReturnType<typeof setTimeout> | null = null;

  openMerge(row: Row, action: NonNullable<CrudConfig['rowActions']>[number]): void {
    this.mergeTargetCode = '';
    this.mergePreview.set(null);
    this.mergeResults.set([]);
    this.mergeError.set('');
    this.mergeAction.set({ row, action });
  }

  // Type-ahead over the same list endpoint the table itself uses (it
  // already searches code/name), so the admin never has to know an exact,
  // correctly-cased code. Editing the text invalidates any preview shown
  // for the previous text — Confirm merges whatever is in the box, so a
  // stale preview must never stay enabled against a changed target.
  onMergeTargetInput(): void {
    this.mergePreview.set(null);
    this.mergeError.set('');
    if (this.mergeSearchTimer) clearTimeout(this.mergeSearchTimer);
    const q = this.mergeTargetCode.trim();
    const ma = this.mergeAction();
    if (!ma || q.length < 2) {
      this.mergeResults.set([]);
      return;
    }
    this.mergeSearchTimer = setTimeout(() => {
      const ownKey = `${ma.row[this.cfg.keyField ?? 'code'] ?? ''}`;
      this.api.get<ListResult>(this.cfg.base, { search: q, limit: 8 }).subscribe({
        next: (r) => {
          const seen = new Set<string>();
          const out: { code: string; label: string }[] = [];
          for (const row of r.data ?? []) {
            const code = `${row['code'] ?? ''}`;
            if (!code || code === ownKey || seen.has(code)) continue;
            seen.add(code);
            const bits =
              ma.action.merge!.noun === 'school'
                ? [row['name'], row['city'], `${row['students'] ?? 0} students`]
                : [row['name'], row['grade'] ? `Grade ${row['grade']}` : '', row['school'], row['competitionCode']];
            out.push({ code, label: bits.filter((b) => b).join(' · ') });
          }
          this.mergeResults.set(out);
          this.cdr.markForCheck();
        },
        error: () => this.mergeResults.set([]),
      });
    }, 250);
  }

  pickMergeTarget(r: { code: string }): void {
    this.mergeTargetCode = r.code;
    this.mergeResults.set([]);
    this.fetchMergePreview();
  }

  closeMerge(): void {
    if (this.mergeBusy()) return;
    this.mergeAction.set(null);
  }

  fetchMergePreview(): void {
    const ma = this.mergeAction();
    const target = this.mergeTargetCode.trim();
    if (!ma || !target || this.mergePreviewBusy()) return;
    const mergeCode = `${ma.row[this.cfg.keyField ?? 'code'] ?? ''}`;
    this.mergePreviewBusy.set(true);
    this.mergeError.set('');
    this.mergePreview.set(null);
    this.api
      .get<MergePreviewResult>(ma.action.merge!.previewUrl, { keepCode: target, mergeCode })
      .subscribe({
        next: (r) => {
          this.mergePreviewBusy.set(false);
          this.mergePreview.set(r);
          this.cdr.markForCheck();
        },
        error: (e) => {
          this.mergePreviewBusy.set(false);
          this.mergeError.set(errText(e));
          this.cdr.markForCheck();
        },
      });
  }

  confirmMerge(): void {
    const ma = this.mergeAction();
    const target = this.mergeTargetCode.trim();
    if (!ma || !target || !this.mergePreview() || this.mergeBusy()) return;
    const mergeCode = `${ma.row[this.cfg.keyField ?? 'code'] ?? ''}`;
    this.mergeBusy.set(true);
    this.mergeError.set('');
    this.api.post(ma.action.merge!.mergeUrl, { keepCode: target, mergeCode }).subscribe({
      next: () => {
        this.mergeBusy.set(false);
        this.mergeAction.set(null);
        this.showToast(`Merged into ${target}`);
        this.load();
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.mergeBusy.set(false);
        this.mergeError.set(errText(e));
        this.cdr.markForCheck();
      },
    });
  }

  private showToast(msg: string) {
    this.toast = msg;
    setTimeout(() => {
      if (this.toast === msg) this.toast = '';
    }, 2200);
  }
}
