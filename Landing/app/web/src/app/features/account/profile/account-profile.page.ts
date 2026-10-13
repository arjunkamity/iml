import {
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { ApiService } from '@core/services/api.service';
import { StudentDataService } from '../student-data.service';
import type { MeProfile } from '../student-data.service';
import { ACCOUNT_UI_CSS } from '../account-ui';
import { formatDate, initialsOf } from '../format';

const GENDERS = ['', 'Male', 'Female', 'Other', 'Prefer not to say'];

interface GradeOption {
  name: string;
}

@Component({
  selector: 'app-account-profile',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="acc-head">
      <div>
        <div class="acc-eyebrow">My Profile</div>
        <h1 class="acc-title">Profile &amp; Settings</h1>
        <p class="acc-sub">View and edit your details, change your password, or sign out.</p>
      </div>
    </div>

    @if (loading()) {
      <div class="loading">Loading profile…</div>
    } @else {
      <div class="acc-grid">
        <!-- profile summary -->
        <div class="card">
          <div class="card-head">
            <h3>Profile</h3>
            <button type="button" class="btn btn-sm" (click)="toggleEdit()">
              {{ editing() ? 'Cancel' : '✎ Edit' }}
            </button>
          </div>

          <div class="photo-row">
            @if (profile()?.photoUrl) {
              <img class="photo-thumb" [src]="profile()?.photoUrl" alt="Your photo" />
            } @else {
              <span class="photo-thumb photo-fallback">{{ initialsOf(profile()?.name) }}</span>
            }
            <div class="photo-actions">
              <label class="btn btn-sm" for="photoFile">{{ uploadingPhoto() ? 'Uploading…' : 'Change Photo' }}</label>
              <input id="photoFile" type="file" accept="image/png,image/jpeg,image/webp" [disabled]="uploadingPhoto()" (change)="onPhotoSelected($event)" hidden />
              @if (profile()?.photoUrl) {
                <button type="button" class="btn btn-sm btn-danger" [disabled]="uploadingPhoto()" (click)="removePhoto()">Remove</button>
              }
            </div>
            @if (photoMsg()) {
              <span class="photo-msg" [class.err]="!photoOk()">{{ photoMsg() }}</span>
            }
          </div>

          @if (!editing()) {
            <dl class="kv">
              <dt>Full name</dt><dd>{{ profile()?.name }}</dd>
              <dt>Reg. code</dt><dd class="mono">{{ profile()?.code }}</dd>
              <dt>Email</dt><dd>{{ profile()?.email ?? '—' }}</dd>
              <dt>Phone</dt><dd>{{ profile()?.phone ?? '—' }}</dd>
              <dt>Grade</dt><dd>{{ profile()?.grade }}</dd>
              <dt>Date of birth</dt><dd>{{ formatDate(profile()?.dob) }}</dd>
              <dt>Gender</dt><dd>{{ profile()?.gender ?? '—' }}</dd>
              <dt>Parent / Guardian</dt><dd>{{ profile()?.parent ?? '—' }}</dd>
              <dt>Parent phone</dt><dd>{{ profile()?.parentPhone ?? '—' }}</dd>
              <dt>School</dt><dd>{{ profile()?.school?.name ?? '—' }}</dd>
              <dt>Address</dt><dd>{{ profile()?.address ?? '—' }}</dd>
            </dl>
          } @else {
            <form (ngSubmit)="saveProfile()" #pf="ngForm">
              <div class="form-grid">
                <div class="field" [class.error]="pf.submitted && !name.value">
                  <label for="name">Full name</label>
                  <input #name="ngModel" id="name" name="name" type="text" [(ngModel)]="edit.name" required maxlength="120" />
                </div>
                <div class="field">
                  <label for="grade">Grade</label>
                  <select id="grade" name="grade" [(ngModel)]="edit.grade">
                    @for (g of gradeOptions(); track g) {
                      <option [value]="g">{{ g }}</option>
                    }
                  </select>
                </div>
                <div class="field">
                  <label for="gender">Gender</label>
                  <select id="gender" name="gender" [(ngModel)]="edit.gender">
                    @for (g of genders; track g) {
                      <option [value]="g">{{ g || 'Prefer not to say' }}</option>
                    }
                  </select>
                </div>
                <div class="field">
                  <label for="dob">Date of birth</label>
                  <input id="dob" name="dob" type="date" [(ngModel)]="edit.dob" />
                </div>
                <div class="field">
                  <label for="phone">Phone</label>
                  <input id="phone" name="phone" type="tel" [(ngModel)]="edit.phone" maxlength="20" />
                </div>
                <div class="field" [class.error]="pf.submitted && emailField.invalid">
                  <label for="email">Email</label>
                  <input #emailField="ngModel" id="email" name="email" type="email" [(ngModel)]="edit.email" maxlength="190" />
                  <span class="hint">Used for sign-in and certificate/result emails — changing it takes effect immediately.</span>
                </div>
                <div class="field">
                  <label for="parentPhone">Parent phone</label>
                  <input id="parentPhone" name="parentPhone" type="tel" [(ngModel)]="edit.parentPhone" maxlength="20" />
                </div>
                <div class="field">
                  <label for="parent">Parent / Guardian</label>
                  <input id="parent" name="parent" type="text" [(ngModel)]="edit.parent" maxlength="120" />
                </div>
                <div class="field">
                  <label for="school">School</label>
                  <input id="school" name="school" type="text" [(ngModel)]="edit.school" maxlength="190" />
                </div>
                <div class="field full">
                  <label for="address">Address</label>
                  <textarea id="address" name="address" [(ngModel)]="edit.address" maxlength="500"></textarea>
                </div>
              </div>

              @if (saveMsg()) {
                <div class="alert" [class.ok]="saveOk()" [class.err]="!saveOk()">{{ saveMsg() }}</div>
              }

              <div class="form-actions">
                <button type="submit" class="btn btn-primary" [disabled]="saving()">Save changes</button>
                <button type="button" class="btn btn-ghost" (click)="cancelEdit()">Cancel</button>
              </div>
            </form>
          }
        </div>

        <!-- change password -->
        <div class="card">
          <div class="card-head"><h3>Change Password</h3></div>
          @if (hasPassword()) {
            <form (ngSubmit)="changePassword()" #cpf="ngForm">
              <div class="form-grid">
                <div class="field full">
                  <label for="cur">Current password</label>
                  <input id="cur" name="cur" type="password" [(ngModel)]="pw.current" required />
                </div>
                <div class="field full">
                  <label for="newp">New password</label>
                  <input id="newp" name="newp" type="password" [(ngModel)]="pw.newPassword" required minlength="6" />
                  <span class="hint">At least 6 characters.</span>
                </div>
              </div>
              @if (pwMsg()) {
                <div class="alert" [class.ok]="pwOk()" [class.err]="!pwOk()">{{ pwMsg() }}</div>
              }
              <div class="form-actions">
                <button type="submit" class="btn btn-primary" [disabled]="savingPw()">Update password</button>
              </div>
            </form>
          } @else {
            <p class="acc-sub" style="margin-bottom: 1rem">
              You signed up with OTP and haven't set a password yet. Set one now so you can sign in with your email and password.
            </p>
            <form (ngSubmit)="changePassword()" #spf="ngForm">
              <div class="field">
                <label for="np">New password</label>
                <input id="np" name="np" type="password" [(ngModel)]="pw.newPassword" required minlength="6" />
                <span class="hint">At least 6 characters.</span>
              </div>
              @if (pwMsg()) {
                <div class="alert" [class.ok]="pwOk()" [class.err]="!pwOk()">{{ pwMsg() }}</div>
              }
              <div class="form-actions">
                <button type="submit" class="btn btn-primary" [disabled]="savingPw()">Set password</button>
              </div>
            </form>
          }
        </div>

        <!-- session -->
        <div class="card wide">
          <div class="card-head"><h3>Session</h3></div>
          <p class="acc-sub">Signing out returns you to the public site. You can sign back in with OTP or your password.</p>
          <div class="form-actions">
            <button type="button" class="btn" style="border-color:rgba(251,113,133,.5);color:#fda4af" (click)="logout()">
              &#8617; Log out
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    ACCOUNT_UI_CSS,
    `
      .acc-av { width: 64px; height: 64px; border-radius: 50%; background: var(--grad); display: grid; place-items: center;
        font-family: var(--display); font-weight: 800; font-size: 1.4rem; color: #0a0820; }
      .photo-row { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.3rem; padding-bottom: 1.3rem;
        border-bottom: 1px solid var(--line, rgba(255,255,255,0.09)); }
      .photo-thumb { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; flex: 0 0 auto; }
      .photo-fallback { background: var(--grad); display: grid; place-items: center;
        font-family: var(--display); font-weight: 800; font-size: 1.3rem; color: #0a0820; }
      .photo-actions { display: flex; align-items: center; gap: 0.6rem; }
      .photo-actions label.btn { cursor: pointer; }
      .photo-msg { font-size: 0.82rem; color: #34d399; }
      .photo-msg.err { color: #fda4af; }
      .btn-danger { color: #fecdd3; border-color: rgba(251, 113, 133, 0.5); background: rgba(251, 113, 133, 0.12); }
      .btn-danger:hover { background: rgba(251, 113, 133, 0.22); }
    `,
  ],
})
export class AccountProfilePage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly data = inject(StudentDataService);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  protected readonly genders = GENDERS;
  protected readonly loading = signal(true);
  protected readonly profile = signal<MeProfile | null>(null);
  protected readonly editing = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveMsg = signal('');
  protected readonly saveOk = signal(false);
  protected readonly savingPw = signal(false);
  protected readonly pwMsg = signal('');
  protected readonly pwOk = signal(false);
  protected readonly gradeOptions = signal<string[]>([]);
  protected readonly uploadingPhoto = signal(false);
  protected readonly photoMsg = signal('');
  protected readonly photoOk = signal(false);

  protected readonly hasPassword = signal(true);

  protected readonly edit = {
    name: '',
    grade: '9',
    gender: '',
    dob: '',
    phone: '',
    email: '',
    parentPhone: '',
    parent: '',
    school: '',
    address: '',
  };

  protected readonly pw = { current: '', newPassword: '' };

  protected readonly email = computed(() => this.auth.user()?.email ?? '—');

  ngOnInit(): void {
    this.api.get<GradeOption[]>('/public/grades').subscribe({
      next: (rows) => this.gradeOptions.set((rows ?? []).map((g) => g.name)),
      error: () => this.gradeOptions.set([]),
    });
    this.data.me().subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.hasPassword.set(profile.hasPassword);
        Object.assign(this.edit, {
          name: profile.name ?? '',
          grade: profile.grade ?? '9',
          gender: profile.gender ?? '',
          dob: profile.dob ? String(profile.dob).slice(0, 10) : '',
          phone: profile.phone ?? '',
          email: profile.email ?? '',
          parentPhone: profile.parentPhone ?? '',
          parent: profile.parent ?? '',
          school: profile.school?.name ?? '',
          address: profile.address ?? '',
        });
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.uploadingPhoto.set(true);
    this.photoMsg.set('');
    this.data.uploadPhoto(file).subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.uploadingPhoto.set(false);
        this.photoOk.set(true);
        this.photoMsg.set('Photo updated.');
        setTimeout(() => this.photoMsg.set(''), 3000);
      },
      error: (err) => {
        this.uploadingPhoto.set(false);
        this.photoOk.set(false);
        this.photoMsg.set(err?.error?.message ?? 'Could not upload your photo.');
      },
    });
  }

  protected removePhoto(): void {
    this.uploadingPhoto.set(true);
    this.photoMsg.set('');
    this.data.removePhoto().subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.uploadingPhoto.set(false);
      },
      error: (err) => {
        this.uploadingPhoto.set(false);
        this.photoOk.set(false);
        this.photoMsg.set(err?.error?.message ?? 'Could not remove your photo.');
      },
    });
  }

  protected toggleEdit(): void {
    this.editing.update((v) => !v);
    this.saveMsg.set('');
  }

  protected cancelEdit(): void {
    this.editing.set(false);
    this.saveMsg.set('');
  }

  protected saveProfile(): void {
    const e = this.edit;
    if (!e.name.trim()) return;
    this.saving.set(true);
    this.saveMsg.set('');
    this.data.updateProfile({ ...e, school: e.school.trim() || undefined }).subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.saving.set(false);
        this.editing.set(false);
        this.saveOk.set(true);
        this.saveMsg.set('Profile updated successfully.');
        setTimeout(() => this.saveMsg.set(''), 4000);
      },
      error: (err) => {
        this.saving.set(false);
        this.saveOk.set(false);
        this.saveMsg.set(err?.error?.message ?? 'Could not save your profile.');
      },
    });
  }

  protected changePassword(): void {
    const { current, newPassword } = this.pw;
    if (!newPassword || newPassword.length < 6) return;
    this.savingPw.set(true);
    this.pwMsg.set('');
    this.data.setPassword({ currentPassword: current || undefined, newPassword }).subscribe({
      next: () => {
        this.savingPw.set(false);
        this.pwOk.set(true);
        this.pwMsg.set('Password updated. Use it to sign in next time.');
        this.pw.current = '';
        this.pw.newPassword = '';
        this.hasPassword.set(true);
        setTimeout(() => this.pwMsg.set(''), 5000);
      },
      error: (err) => {
        this.savingPw.set(false);
        this.pwOk.set(false);
        this.pwMsg.set(err?.error?.message ?? 'Could not update the password.');
      },
    });
  }

  protected logout(): void {
    this.auth.logout();
    this.router.navigate(['/']);
  }

  protected formatDate = formatDate;
  protected initialsOf = initialsOf;
}
