import { Component, OnInit, inject, signal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { ApiService } from '@core/services/api.service';

interface FaqItem {
  q: string;
  a: string;
}

@Component({
  selector: 'app-faq',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="section legal-page">
      <div class="container">
        <div class="hb-title"><span>Frequently Asked Questions</span></div>
        <p class="lead">Everything you need to know before you register. Can't find your answer? <a routerLink="/" [fragment]="'contact'">Contact us</a>.</p>

        @if (loading()) {
          <p class="lead">Loading…</p>
        } @else if (faqs().length) {
          <div class="faq-list">
            @for (item of faqs(); track item.q; let i = $index) {
              <div class="faq-item" [class.open]="openIndex() === i">
                <button type="button" class="faq-q" (click)="toggle(i)" [attr.aria-expanded]="openIndex() === i">
                  <span>{{ item.q }}</span>
                  <span class="faq-caret" aria-hidden="true">⌄</span>
                </button>
                @if (openIndex() === i) {
                  <p class="faq-a">{{ item.a }}</p>
                }
              </div>
            }
          </div>
        } @else {
          <p class="lead">No FAQs published yet — check back soon.</p>
        }
      </div>
    </section>
  `,
})
export class FaqPage implements OnInit {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly api = inject(ApiService);

  readonly faqs = signal<FaqItem[]>([]);
  readonly loading = signal(true);
  readonly openIndex = signal<number | null>(0);

  constructor() {
    this.title.setTitle('FAQs — India Mind League');
    this.meta.updateTag({
      name: 'description',
      content: 'Answers to common questions about eligibility, fees, assessment stages and certificates for India Mind League.',
    });
  }

  ngOnInit(): void {
    this.api.get<FaqItem[]>('/public/faqs').subscribe({
      next: (rows) => {
        this.faqs.set(rows ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.faqs.set([]);
        this.loading.set(false);
      },
    });
  }

  toggle(i: number) {
    this.openIndex.update((cur) => (cur === i ? null : i));
  }
}
