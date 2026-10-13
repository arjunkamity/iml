import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '@core/services/api.service';
import {
  AddStudentPayload,
  SchoolDataService,
  SchoolStudentRow,
  UpdateStudentPayload,
} from './school-data.service';
import { ADMIN_UI_CSS } from '@admin/admin-ui';

function errText(e: HttpErrorResponse): string {
  const m = (e.error as { message?: string | string[] })?.message;
  if (Array.isArray(m)) return m[0] ?? 'Something went wrong.';
  return m ?? 'Something went wrong.';
}

interface GradeOption {
  name: string;
}

interface BulkUploadRowError {
  row: number;
  message: string;
}

interface BulkUploadResult {
  total: number;
  created: number;
  failed: number;
  errors: BulkUploadRowError[];
}

const STATUS_BADGE: Record<string, string> = {
  Registered: 'blue',
  'Test Taken': 'purple',
  Qualified: 'green',
  Eliminated: 'red',
};

@Component({
  selector: 'app-school-students',
  standalone: true,
  imports: [FormsModule, NgClass],
  template: `
    <div class="bar">
      <input class="search" placeholder="Search student…" [(ngModel)]="search" (keyup.enter)="go(1)" />
      <select class="filter" [(ngModel)]="comp" (ngModelChange)="go(1)">
        <option value="">All competitions</option>
        @for (c of competitions(); track c.code) {
          <option [value]="c.code">{{ c.title }}</option>
        }
      </select>
      <select class="filter" [(ngModel)]="grade" (ngModelChange)="go(1)">
        <option value="">All Class</option>
        @for (g of grades(); track g) {
          <option [value]="g">{{ g }}</option>
        }
      </select>
      <select class="filter" [(ngModel)]="paymentStatus" (ngModelChange)="go(1)">
        <option value="">All Payment</option>
        <option value="Paid">Paid</option>
        <option value="Unpaid">Unpaid</option>
      </select>
      <div class="grow"></div>
      <button class="btn" [disabled]="exportBusy()" (click)="exportXlsx()">{{ exportBusy() ? 'Preparing…' : '⇩ Export Excel' }}</button>
      <button class="btn" (click)="openBulk()">⇪ Bulk Upload</button>
      <button class="btn btn-gold" (click)="openAdd()">+ Add Student</button>
    </div>

    @if (error()) {
      <div class="err">{{ error() }}</div>
    }

    <div class="tbl-wrap">
      <table>
        <thead>
          <tr><th>Code</th><th>Student</th><th>Grade</th><th>Competition</th><th>Status</th><th>Payment</th><th>Registered</th><th></th></tr>
        </thead>
        <tbody>
          @for (r of rows(); track r.code) {
            <tr>
              <td data-label="Code">{{ r.code }}</td>
              <td data-label="Student">
                <span class="b">{{ r.name }}</span>
                @if (r.email || r.phone) {
                  <br /><small style="color:var(--faint,#6e7f9e)">{{ r.email }}{{ r.email && r.phone ? ' · ' : '' }}{{ r.phone }}</small>
                }
              </td>
              <td data-label="Grade">{{ r.grade }}</td>
              <td data-label="Competition">
                <small>{{ r.competitionCode }}</small><br />
                {{ r.competition }}
              </td>
              <td data-label="Status"><span class="bdg" [ngClass]="statusBadge(r.status)">{{ r.status }}</span></td>
              <td data-label="Payment"><span class="bdg" [ngClass]="r.paid === 'Paid' ? 'green' : 'grey'">{{ r.paid || 'Unpaid' }}</span></td>
              <td data-label="Registered">{{ when(r.registeredAt) }}</td>
              <td>
                <div class="kebab-wrap">
                  <button class="btn btn-sm kebab-btn" title="Actions" (click)="$event.stopPropagation(); toggleMenu(r.code)">&#8942;</button>
                  @if (openMenuFor() === r.code) {
                    <div class="kebab-menu" (click)="$event.stopPropagation()">
                      <button type="button" (click)="openEdit(r); closeMenu()">Edit</button>
                    </div>
                  }
                </div>
              </td>
            </tr>
          } @empty {
            <tr><td colspan="8" class="empty">No students registered yet.</td></tr>
          }
        </tbody>
      </table>
    </div>

    @if (total() > 0) {
      <div class="pager">
        <span>{{ (page() - 1) * limit + 1 }}–{{ min(page() * limit, total()) }} of {{ total() }}</span>
        <button class="btn btn-sm" [disabled]="page() <= 1" (click)="go(page() - 1)">← Prev</button>
        <button class="btn btn-sm" [disabled]="page() * limit >= total()" (click)="go(page() + 1)">Next →</button>
      </div>
    }

    @if (addOpen()) {
      <div class="modal-root" (click)="closeAdd()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="m-head">
            <h3>Add Student</h3>
            <button class="m-x" (click)="closeAdd()">✕</button>
          </div>
          <form (ngSubmit)="submitAdd()">
            <div class="m-body">
              <div class="f full">
                <label>Competition *</label>
                <select [(ngModel)]="addForm.competitionCode" name="competitionCode" required>
                  <option value="" disabled>Select a competition</option>
                  @for (c of competitions(); track c.code) {
                    <option [value]="c.code">{{ c.title }}</option>
                  }
                </select>
              </div>
              <div class="f-row">
                <div class="f">
                  <label>Student name *</label>
                  <input [(ngModel)]="addForm.name" name="name" required />
                </div>
                <div class="f">
                  <label>Grade *</label>
                  <select [(ngModel)]="addForm.grade" name="grade" required>
                    <option value="" disabled>Select grade</option>
                    @for (g of grades(); track g) {
                      <option [value]="g">{{ g }}</option>
                    }
                  </select>
                </div>
              </div>
              <div class="f-row">
                <div class="f">
                  <label>Student email</label>
                  <input type="email" [(ngModel)]="addForm.email" name="email" />
                </div>
                <div class="f">
                  <label>Student phone</label>
                  <input [(ngModel)]="addForm.phone" name="phone" />
                </div>
              </div>
              <div class="f full">
                <label>Parent / guardian</label>
                <input [(ngModel)]="addForm.parent" name="parent" />
              </div>
              @if (addError()) {
                <div class="err">{{ addError() }}</div>
              }
            </div>
            <div class="m-foot">
              <button type="button" class="btn" (click)="closeAdd()">Cancel</button>
              <button type="submit" class="btn btn-gold" [disabled]="adding()">{{ adding() ? 'Adding…' : 'Add Student' }}</button>
            </div>
          </form>
        </div>
      </div>
    }

    @if (editOpen()) {
      <div class="modal-root" (click)="closeEdit()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="m-head">
            <h3>Edit Student — {{ editCode }}</h3>
            <button class="m-x" (click)="closeEdit()">✕</button>
          </div>
          <form (ngSubmit)="submitEdit()">
            <div class="m-body">
              <p class="hint" style="margin:-0.2rem 0 0.9rem;">Competition can't be changed here — contact support to move a student between competitions.</p>
              <div class="f-row">
                <div class="f">
                  <label>Student name *</label>
                  <input [(ngModel)]="editForm.name" name="editName" required />
                </div>
                <div class="f">
                  <label>Grade *</label>
                  <select [(ngModel)]="editForm.grade" name="editGrade" required>
                    @for (g of grades(); track g) {
                      <option [value]="g">{{ g }}</option>
                    }
                  </select>
                </div>
              </div>
              <div class="f-row">
                <div class="f">
                  <label>Student email</label>
                  <input type="email" [(ngModel)]="editForm.email" name="editEmail" />
                </div>
                <div class="f">
                  <label>Student phone</label>
                  <input [(ngModel)]="editForm.phone" name="editPhone" />
                </div>
              </div>
              <div class="f full">
                <label>Parent / guardian</label>
                <input [(ngModel)]="editForm.parent" name="editParent" />
              </div>
              @if (editError()) {
                <div class="err">{{ editError() }}</div>
              }
            </div>
            <div class="m-foot">
              <button type="button" class="btn" (click)="closeEdit()">Cancel</button>
              <button type="submit" class="btn btn-gold" [disabled]="editSaving()">{{ editSaving() ? 'Saving…' : 'Save changes' }}</button>
            </div>
          </form>
        </div>
      </div>
    }

    @if (bulkOpen()) {
      <div class="modal-root" (click)="closeBulk()">
        <div class="modal wide" (click)="$event.stopPropagation()">
          <div class="m-head">
            <h3>Bulk Upload — Students</h3>
            <button class="m-x" (click)="closeBulk()">✕</button>
          </div>
          <div class="m-body">
            @if (bulkError()) {
              <div class="err">{{ bulkError() }}</div>
            }
            <p class="hint">
              Upload a CSV file to register many students at once, all under your school.
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
            @if (bulkResult()) {
              <div class="bulk-summary">
                <span class="bdg green">{{ bulkResult()!.created }} created</span>
                @if (bulkResult()!.failed) {
                  <span class="bdg red">{{ bulkResult()!.failed }} failed</span>
                }
                <span class="bdg grey">{{ bulkResult()!.total }} row{{ bulkResult()!.total === 1 ? '' : 's' }} in file</span>
              </div>
              @if (bulkResult()!.errors.length) {
                <div class="bulk-errors-wrap">
                  <table class="mini">
                    <thead><tr><th>Row</th><th>Issue</th></tr></thead>
                    <tbody>
                      @for (e of bulkResult()!.errors; track e.row) {
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
            <button class="btn btn-gold" [disabled]="!bulkFile || bulkUploading()" (click)="uploadBulk()">
              {{ bulkUploading() ? 'Uploading…' : 'Upload' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [ADMIN_UI_CSS],
})
export class SchoolStudentsPage implements OnInit {
  private readonly data = inject(SchoolDataService);
  private readonly api = inject(ApiService);

  protected readonly rows = signal<SchoolStudentRow[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly limit = 15;
  protected search = '';
  protected comp = '';
  protected grade = '';
  protected paymentStatus = '';
  protected readonly error = signal('');
  protected readonly exportBusy = signal(false);

  protected readonly competitions = signal<{ code: string; title: string }[]>([]);
  protected readonly grades = signal<string[]>([]);

  // Row actions "3 dots" menu — see .kebab-* in ADMIN_UI_CSS.
  protected readonly openMenuFor = signal<string | null>(null);

  @HostListener('document:click')
  protected closeMenu(): void {
    this.openMenuFor.set(null);
  }

  protected toggleMenu(code: string): void {
    this.openMenuFor.set(this.openMenuFor() === code ? null : code);
  }

  protected readonly addOpen = signal(false);
  protected readonly adding = signal(false);
  protected readonly addError = signal('');
  protected addForm: AddStudentPayload = { competitionCode: '', name: '', grade: '', email: '', phone: '', parent: '' };

  protected readonly editOpen = signal(false);
  protected readonly editSaving = signal(false);
  protected readonly editError = signal('');
  protected editCode = '';
  protected editForm: UpdateStudentPayload = { name: '', grade: '', email: '', phone: '', parent: '' };

  protected readonly bulkOpen = signal(false);
  protected readonly bulkUploading = signal(false);
  protected readonly bulkError = signal('');
  protected readonly bulkResult = signal<BulkUploadResult | null>(null);
  protected bulkFile: File | null = null;

  ngOnInit(): void {
    this.load();
    this.data.competitions().subscribe({
      next: (rows) => this.competitions.set(rows),
      error: () => this.competitions.set([]),
    });
    this.api.get<GradeOption[]>('/public/grades').subscribe({
      next: (rows) => this.grades.set((rows ?? []).map((g) => g.name)),
      error: () => this.grades.set([]),
    });
  }

  private load(): void {
    this.error.set('');
    this.data
      .students(this.page(), this.limit, this.search.trim() || undefined, this.comp || undefined, this.grade || undefined, this.paymentStatus || undefined)
      .subscribe({
        next: (r) => {
          this.rows.set(r.data);
          this.total.set(r.total);
        },
        error: (e) => this.error.set(errText(e)),
      });
  }

  protected exportXlsx(): void {
    if (this.exportBusy()) return;
    const params: Record<string, unknown> = {};
    if (this.search.trim()) params['search'] = this.search.trim();
    if (this.comp) params['comp'] = this.comp;
    if (this.grade) params['grade'] = this.grade;
    if (this.paymentStatus) params['paymentStatus'] = this.paymentStatus;
    this.exportBusy.set(true);
    this.api.downloadBlob('/school/students/export', params).subscribe({
      next: (blob) => {
        this.exportBusy.set(false);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'registrations-export.xlsx';
        a.click();
        URL.revokeObjectURL(url);
      },
      error: (e) => {
        this.exportBusy.set(false);
        this.error.set(errText(e));
      },
    });
  }

  protected go(p: number): void {
    this.page.set(p);
    this.load();
  }

  protected min(a: number, b: number): number {
    return Math.min(a, b);
  }

  protected when(iso: string): string {
    return iso ? iso.slice(0, 10) : '—';
  }

  protected statusBadge(s: string): string {
    return STATUS_BADGE[s] ?? 'grey';
  }

  protected openAdd(): void {
    this.addForm = { competitionCode: '', name: '', grade: '', email: '', phone: '', parent: '' };
    this.addError.set('');
    this.addOpen.set(true);
  }

  protected closeAdd(): void {
    this.addOpen.set(false);
  }

  protected submitAdd(): void {
    if (this.adding()) return;
    if (!this.addForm.competitionCode || !this.addForm.name.trim() || !this.addForm.grade) {
      this.addError.set('Competition, student name and grade are required.');
      return;
    }
    this.adding.set(true);
    this.addError.set('');
    const payload: AddStudentPayload = {
      competitionCode: this.addForm.competitionCode,
      name: this.addForm.name.trim(),
      grade: this.addForm.grade,
      email: this.addForm.email?.trim() || undefined,
      phone: this.addForm.phone?.trim() || undefined,
      parent: this.addForm.parent?.trim() || undefined,
    };
    this.data.addStudent(payload).subscribe({
      next: () => {
        this.adding.set(false);
        this.addOpen.set(false);
        this.go(1);
      },
      error: (e) => {
        this.adding.set(false);
        this.addError.set(errText(e));
      },
    });
  }

  protected openEdit(r: SchoolStudentRow): void {
    this.editCode = r.code;
    this.editForm = {
      name: r.name,
      grade: r.grade,
      email: r.email ?? '',
      phone: r.phone ?? '',
      parent: r.parent ?? '',
    };
    this.editError.set('');
    this.editOpen.set(true);
  }

  protected closeEdit(): void {
    this.editOpen.set(false);
  }

  protected submitEdit(): void {
    if (this.editSaving()) return;
    if (!this.editForm.name?.trim() || !this.editForm.grade) {
      this.editError.set('Student name and grade are required.');
      return;
    }
    this.editSaving.set(true);
    this.editError.set('');
    const payload: UpdateStudentPayload = {
      name: this.editForm.name.trim(),
      grade: this.editForm.grade,
      email: this.editForm.email?.trim() || undefined,
      phone: this.editForm.phone?.trim() || undefined,
      parent: this.editForm.parent?.trim() || undefined,
    };
    this.data.updateStudent(this.editCode, payload).subscribe({
      next: () => {
        this.editSaving.set(false);
        this.editOpen.set(false);
        this.load();
      },
      error: (e) => {
        this.editSaving.set(false);
        this.editError.set(errText(e));
      },
    });
  }

  protected openBulk(): void {
    this.bulkFile = null;
    this.bulkError.set('');
    this.bulkResult.set(null);
    this.bulkOpen.set(true);
  }

  protected closeBulk(): void {
    if (this.bulkUploading()) return;
    this.bulkOpen.set(false);
    if (this.bulkResult()?.created) this.go(1);
  }

  protected onFileSelected(evt: Event): void {
    const input = evt.target as HTMLInputElement;
    this.bulkFile = input.files?.[0] ?? null;
    this.bulkResult.set(null);
    this.bulkError.set('');
  }

  protected bulkFileSizeKb(): number {
    return this.bulkFile ? Math.ceil(this.bulkFile.size / 1024) : 0;
  }

  protected downloadSample(): void {
    this.bulkError.set('');
    this.api.downloadBlob('/school/students/bulk-upload/sample').subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'students-sample.csv';
        a.click();
        URL.revokeObjectURL(url);
      },
      error: (e) => this.bulkError.set(errText(e)),
    });
  }

  protected uploadBulk(): void {
    if (!this.bulkFile || this.bulkUploading()) return;
    this.bulkUploading.set(true);
    this.bulkError.set('');
    this.bulkResult.set(null);
    this.api.postFile<BulkUploadResult>('/school/students/bulk-upload', this.bulkFile).subscribe({
      next: (r) => {
        this.bulkUploading.set(false);
        this.bulkResult.set(r);
      },
      error: (e) => {
        this.bulkUploading.set(false);
        this.bulkError.set(errText(e));
      },
    });
  }
}
