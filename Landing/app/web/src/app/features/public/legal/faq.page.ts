import { Component, inject, signal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';

interface FaqItem {
  q: string;
  a: string;
}

const FAQS: FaqItem[] = [
  {
    q: 'What is India Mind League?',
    a: 'India Mind League is a national Intellectual and Leadership Championship designed to develop IQ, EQ, SQ and Leadership Intelligence among school students.',
  },
  {
    q: 'Who can participate?',
    a: 'Students studying in Classes IX–XII from recognized schools as notified for the current edition.',
  },
  {
    q: 'Can students register individually?',
    a: 'Yes. Students may register individually or through their schools.',
  },
  {
    q: 'Is this only a quiz competition?',
    a: 'No. It includes critical thinking, leadership, communication, emotional intelligence, creativity, decision-making and real-world problem-solving.',
  },
  {
    q: 'Is the competition online or offline?',
    a: 'Different stages may be conducted online, hybrid or offline depending on the competition format.',
  },
  {
    q: 'What skills are assessed?',
    a: 'Participants may be assessed on Intellectual Intelligence (IQ), Emotional Intelligence (EQ), Spiritual Intelligence (SQ), Leadership Intelligence (LQ), Creativity, Communication, Decision Making, Ethics, Innovation, Collaboration and General Awareness.',
  },
  {
    q: 'Will every participant receive a certificate?',
    a: 'Yes. Eligible participants who complete the assessment successfully will receive a digital Certificate of Participation.',
  },
  {
    q: 'How are winners selected?',
    a: 'Participants are evaluated through predefined scoring criteria across different stages by expert evaluators and the competition system.',
  },
  {
    q: 'Can parents accompany students?',
    a: 'Parents may accompany students during designated offline events, subject to venue guidelines.',
  },
  {
    q: 'Is there a registration fee?',
    a: 'Yes — ₹500 for the online qualifier, and ₹3,500 for students shortlisted to the Stage 3 Leadership Bootcamp.',
  },
  {
    q: 'Will scholarships be provided?',
    a: 'Scholarships and special opportunities may be offered subject to partnerships, sponsorships and the policies applicable for each edition.',
  },
  {
    q: 'How will participants receive updates?',
    a: 'Registered participants will receive updates through email, SMS, WhatsApp (where applicable) and the official IML website.',
  },
  {
    q: 'What happens in case of technical issues during the assessment?',
    a: 'Participants should immediately report the issue through the official support channels. Each case will be reviewed individually according to the competition guidelines.',
  },
  {
    q: 'How can schools become official partners?',
    a: 'Schools may register as Institutional Partners by contacting the India Mind League Organising Committee through the official website.',
  },
  {
    q: 'Where can participants seek support?',
    a: 'Participants may contact the India Mind League Help Desk through the official email, helpline number or website support portal during working hours.',
  },
];

@Component({
  selector: 'app-faq',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="section legal-page">
      <div class="container">
        <div class="hb-title"><span>Frequently Asked Questions</span></div>
        <p class="lead">Everything you need to know before you register. Can't find your answer? <a routerLink="/" [fragment]="'contact'">Contact us</a>.</p>

        <div class="faq-list">
          @for (item of faqs; track item.q; let i = $index) {
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
      </div>
    </section>
  `,
})
export class FaqPage {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  readonly faqs = FAQS;
  readonly openIndex = signal<number | null>(0);

  constructor() {
    this.title.setTitle('FAQs — India Mind League');
    this.meta.updateTag({
      name: 'description',
      content: 'Answers to common questions about eligibility, fees, assessment stages and certificates for India Mind League.',
    });
  }

  toggle(i: number) {
    this.openIndex.update((cur) => (cur === i ? null : i));
  }
}
