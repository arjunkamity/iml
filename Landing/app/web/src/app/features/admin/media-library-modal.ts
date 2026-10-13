import { Component, EventEmitter, Input, OnChanges, Output, inject, signal } from '@angular/core';
import { ApiService } from '@core/services/api.service';
import { ADMIN_UI_CSS } from './admin-ui';

interface MediaFile {
  url: string;
  name: string;
  folder: string;
  size: number;
  lastModified: string;
}

function errText(err: unknown): string {
  const e = err as { error?: { message?: string }; message?: string };
  return e?.error?.message ?? e?.message ?? 'Something went wrong';
}

/**
 * WordPress-style media picker: browse files already uploaded to this
 * folder in Azure Blob Storage, or upload a new one — either way you get
 * back a URL via (selected). Never opens the OS file dialog directly.
 */
@Component({
  selector: 'app-media-library-modal',
  standalone: true,
  template: `
    <div class="modal-root" (click)="close.emit()">
      <div class="modal wide" (click)="$event.stopPropagation()">
        <div class="m-head">
          <h3>Select an Image</h3>
          <button class="m-x" (click)="close.emit()">✕</button>
        </div>
        <div class="m-body">
          @if (uploadError()) {
            <div class="err">{{ uploadError() }}</div>
          }
          <div class="ml-upload">
            <label class="btn btn-gold" [class.disabled]="uploading()">
              {{ uploading() ? 'Uploading…' : '⬆ Upload New' }}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon"
                style="display:none"
                [disabled]="uploading()"
                (change)="onFileSelected($event)"
              />
            </label>
            <span class="hint" style="margin-left:0.9rem;">PNG, JPEG, WebP, SVG or ICO — up to 5 MB.</span>
          </div>

          @if (loading()) {
            <div class="empty">Loading…</div>
          } @else if (files().length) {
            <div class="ml-grid">
              @for (f of files(); track f.url) {
                <button type="button" class="ml-item" (click)="select(f)" [title]="f.name">
                  <img [src]="f.url" [alt]="f.name" loading="lazy" />
                  <span class="ml-name">{{ shortName(f.name) }}</span>
                </button>
              }
            </div>
          } @else {
            <div class="empty">No files uploaded yet — upload one above.</div>
          }
        </div>
        <div class="m-foot">
          <button class="btn" (click)="close.emit()">Cancel</button>
        </div>
      </div>
    </div>
  `,
  styles: [
    ADMIN_UI_CSS,
    `
      .ml-upload { display: flex; align-items: center; margin-bottom: 1.1rem; flex-wrap: wrap; gap: 0.3rem; }
      .ml-upload label.disabled { opacity: 0.6; pointer-events: none; }
      .ml-grid {
        display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 0.8rem;
        max-height: 50vh; overflow-y: auto; padding: 0.2rem;
      }
      .ml-item {
        display: flex; flex-direction: column; align-items: center; gap: 0.4rem; padding: 0.6rem;
        border-radius: 10px; border: 1px solid var(--line, rgba(255,255,255,0.09));
        background: rgba(0, 0, 0, 0.2); cursor: pointer; font: inherit; color: inherit;
      }
      .ml-item:hover { border-color: var(--gold, #e8b64a); background: rgba(232, 182, 74, 0.08); }
      .ml-item img { width: 100%; height: 80px; object-fit: contain; background: rgba(255, 255, 255, 0.04); border-radius: 6px; }
      .ml-name {
        font-size: 0.72rem; color: var(--muted, #9fb0d0); overflow: hidden; text-overflow: ellipsis;
        white-space: nowrap; width: 100%; text-align: center;
      }
    `,
  ],
})
export class MediaLibraryModal implements OnChanges {
  @Input() folder = 'misc';
  @Output() readonly selected = new EventEmitter<string>();
  @Output() readonly close = new EventEmitter<void>();

  private readonly api = inject(ApiService);
  protected readonly files = signal<MediaFile[]>([]);
  protected readonly loading = signal(true);
  protected readonly uploading = signal(false);
  protected readonly uploadError = signal('');

  ngOnChanges(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api.get<MediaFile[]>('/uploads', { folder: this.folder }).subscribe({
      next: (files) => {
        this.files.set(files);
        this.loading.set(false);
      },
      error: () => {
        this.files.set([]);
        this.loading.set(false);
      },
    });
  }

  protected select(f: MediaFile): void {
    this.selected.emit(f.url);
  }

  protected onFileSelected(evt: Event): void {
    const input = evt.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // allow re-picking the same file later
    if (!file) return;

    this.uploadError.set('');
    this.uploading.set(true);
    this.api.postFile<MediaFile>(`/uploads?folder=${encodeURIComponent(this.folder)}`, file).subscribe({
      next: (uploaded) => {
        this.uploading.set(false);
        this.files.update((list) => [uploaded, ...list]);
        this.selected.emit(uploaded.url);
      },
      error: (e) => {
        this.uploading.set(false);
        this.uploadError.set(errText(e));
      },
    });
  }

  protected shortName(name: string): string {
    const base = name.split('/').pop() ?? name;
    return base.length > 22 ? `${base.slice(0, 10)}…${base.slice(-8)}` : base;
  }
}
