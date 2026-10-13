import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '@core/services/api.service';
import { ADMIN_UI_CSS } from './admin-ui';

interface Summary {
  registrations: number;
  competitions: number;
  questions: number;
  upcomingExams: number;
  students: number;
  paidPayments: number;
  schools: number;
  paidAmount: number;
}

interface Recent {
  recentRegistrations: Array<{
    code: string;
    status: string;
    student: { name: string; grade: string; email: string | null };
    competition: { title: string };
  }>;
  upcomingExams: Array<{
    code: string;
    title: string;
    grade: string;
    date: string;
    time: string;
    status: string;
    competition: { title: string };
  }>;
}

interface Ratio {
  label: string;
  count: number;
}

interface Analytics {
  registrationTrend: Array<{ date: string; count: number }>;
  topSchools: Ratio[];
  topSchoolsTrend: { days: string[]; series: Array<{ label: string; counts: number[] }> };
  genderRatio: Ratio[];
  paymentStatus: Ratio[];
  classRatio: Ratio[];
  cityRatio: Ratio[];
  categoryPerformance: Array<{ category: string; total: number; correct: number; percent: number }>;
}

interface DonutSegment extends Ratio {
  color: string;
  percent: number;
  dasharrayHidden: string;
  dasharrayFinal: string;
}

const CHART_COLORS = ['#f5cc5a', '#93c5fd', '#86efac', '#f9a8d4', '#d8ccff', '#fda4af', '#67e8f9', '#fdba74'];
const DONUT_R = 46;
const DONUT_C = 2 * Math.PI * DONUT_R;

function toDonut(data: Ratio[]): DonutSegment[] {
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  let offset = 0;
  return data.map((d, i) => {
    const len = (d.count / total) * DONUT_C;
    const seg: DonutSegment = {
      ...d,
      percent: Math.round((d.count / total) * 100),
      color: CHART_COLORS[i % CHART_COLORS.length],
      dasharrayHidden: `0 ${DONUT_C}`,
      dasharrayFinal: `${len} ${DONUT_C - len}`,
    };
    // consumed via rotation below, not stored on the segment itself
    void offset;
    offset += len;
    return seg;
  });
}

/** Cumulative rotation (in the circle's own 360°) so each segment starts
 * exactly where the previous one ended — computed alongside toDonut()
 * rather than folded into it so the template can bind a plain number. */
function donutRotations(data: Ratio[]): number[] {
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  const rotations: number[] = [];
  let acc = 0;
  for (const d of data) {
    rotations.push((acc / total) * 360);
    acc += d.count;
  }
  return rotations;
}

function levelColor(percent: number): string {
  if (percent >= 70) return '#86efac';
  if (percent >= 50) return '#f5cc5a';
  return '#e8b64a';
}

/** Quadratic-bezier-through-midpoints — a small, well-known trick for
 * turning a plain point list into a visually smooth curve (no external
 * charting library): each segment curves toward the midpoint of the next
 * pair of points instead of jumping straight to it. */
function smoothPath(points: { x: number; y: number }[]): string {
  if (!points.length) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const cur = points[i];
    const next = points[i + 1];
    const mx = (cur.x + next.x) / 2;
    const my = (cur.y + next.y) / 2;
    d += ` Q ${cur.x} ${cur.y} ${mx} ${my}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="grid g4-auto">
      <a class="card stat stat-link" href="/admin/registrations"><small>Registrations</small><b>{{ s()?.registrations ?? '—' }}</b></a>
      <a class="card stat stat-link" href="/admin/schools"><small>Schools</small><b>{{ s()?.schools ?? '—' }}</b></a>
      <a class="card stat stat-link" href="/admin/questions"><small>Questions</small><b>{{ s()?.questions ?? '—' }}</b></a>
      <a class="card stat stat-link" href="/admin/payments"><small>Payments</small><b>{{ formatINR(s()?.paidAmount) }}</b></a>
    </div>

    <!-- ---------- Section 1: trends (2 col, 50/50) ---------- -->
    <div class="grid g2" style="margin-top:1rem" [class.revealed]="revealed()">
      <div class="card chart-card">
        <h3>Registration Trend <small class="sec-sub">Last 30 days</small></h3>
        @if (trendPoints().length > 1) {
          <svg class="line-chart" viewBox="0 0 400 160" preserveAspectRatio="none"
               (mousemove)="onTrendMove($event)" (mouseleave)="onTrendLeave()">
            <line class="grid-line" x1="0" y1="40" x2="400" y2="40" />
            <line class="grid-line" x1="0" y1="80" x2="400" y2="80" />
            <line class="grid-line" x1="0" y1="120" x2="400" y2="120" />
            <polygon class="line-fill" [attr.points]="areaPoints()" />
            <polyline class="line-stroke" pathLength="1" [attr.points]="trendPointsStr()" />
            @for (p of trendPoints(); track $index; let i = $index) {
              <circle
                class="line-dot" [class.active]="hoveredTrend()?.label === trendDateLabel(i)"
                [attr.cx]="p.x" [attr.cy]="p.y" r="3.2" [style.animation-delay.ms]="i * 25"
              />
            }
          </svg>
          <div class="line-labels">
            <span>{{ trendDateLabel(0) }}</span>
            <span>{{ trendDateLabel(trendPoints().length - 1) }}</span>
          </div>
          @if (hoveredTrend(); as h) {
            <div class="chart-tooltip" [style.left.px]="tooltipPos().x" [style.top.px]="tooltipPos().y">
              <span class="tt-swatch" [style.background]="h.color"></span>{{ h.label }}<b>{{ h.count }}</b>
            </div>
          }
        } @else {
          <div class="empty">Not enough data yet.</div>
        }
      </div>

      <div class="card chart-card">
        <h3>Top 5 Schools <small class="sec-sub">daily registrations, last 30 days</small></h3>
        @if (schoolSeries().length) {
          <svg class="line-chart" viewBox="0 0 400 160" preserveAspectRatio="none"
               (mousemove)="onSchoolsMove($event)" (mouseleave)="onSchoolsLeave()">
            <line class="grid-line" x1="0" y1="20" x2="400" y2="20" />
            <line class="grid-line" x1="0" y1="80" x2="400" y2="80" />
            <line class="grid-line" x1="0" y1="140" x2="400" y2="140" />
            @for (sr of schoolSeries(); track sr.label) {
              <path
                class="mline-path" [class.dim]="highlightedSchool() && highlightedSchool() !== sr.label"
                [style.stroke]="sr.color"
                [attr.pathLength]="1"
                [attr.d]="sr.path"
              />
            }
          </svg>
          <div class="line-labels">
            <span>{{ schoolTrendDays()[0] }}</span>
            <span>{{ schoolTrendDays()[schoolTrendDays().length - 1] }}</span>
          </div>
          @if (hoveredSchool(); as h) {
            <div class="chart-tooltip" [style.left.px]="tooltipPos().x" [style.top.px]="tooltipPos().y">
              <span class="tt-title">{{ h.dateLabel }}</span>
              <span class="tt-swatch" [style.background]="h.color"></span>{{ h.label }}<b>{{ h.count }}</b>
            </div>
          }
        } @else {
          <div class="empty">No school data yet.</div>
        }
      </div>
    </div>

    <!-- ---------- Section 2: ratios (4 col) ---------- -->
    <h2 class="sec-title">Participant Mix</h2>
    <div class="grid g4-auto" [class.revealed]="revealed()">
      <div class="card donut-card">
        <h3>Gender Ratio</h3>
        <ng-container [ngTemplateOutlet]="donut" [ngTemplateOutletContext]="{ segs: genderDonut(), rot: genderRotations(), key: 'gender' }" />
      </div>
      <div class="card donut-card">
        <h3>Payment Status</h3>
        <ng-container [ngTemplateOutlet]="donut" [ngTemplateOutletContext]="{ segs: paymentDonut(), rot: paymentRotations(), key: 'payment' }" />
      </div>
      <div class="card donut-card">
        <h3>Class Ratio</h3>
        <ng-container [ngTemplateOutlet]="donut" [ngTemplateOutletContext]="{ segs: classDonut(), rot: classRotations(), key: 'class' }" />
      </div>
      <div class="card donut-card">
        <h3>City Ratio</h3>
        <ng-container [ngTemplateOutlet]="donut" [ngTemplateOutletContext]="{ segs: cityDonut(), rot: cityRotations(), key: 'city' }" />
      </div>
    </div>

    <!-- shared donut markup — one ring + a legend list, reused for all four
         ratio cards above via ngTemplateOutlet rather than duplicating the
         same SVG four times. Hovering a segment (or its legend row) swaps
         the center label from the overall total to that segment's own
         label/count/percent. -->
    <ng-template #donut let-segs="segs" let-rot="rot" let-key="key">
      @if (segs.length) {
        <div class="donut-wrap">
          <svg class="donut-svg" viewBox="0 0 120 120">
            @for (seg of segs; track seg.label; let i = $index) {
              <circle
                class="donut-seg" [class.dim]="hoveredDonut(key) && hoveredDonut(key)!.label !== seg.label"
                cx="60" cy="60" r="46"
                [style.stroke]="seg.color"
                [style.transform]="'rotate(' + rot[i] + 'deg)'"
                style="transform-origin: 60px 60px;"
                [attr.stroke-dasharray]="revealed() ? seg.dasharrayFinal : seg.dasharrayHidden"
                (mouseenter)="setDonutHover(key, seg)"
                (mouseleave)="setDonutHover(key, null)"
              />
            }
          </svg>
          <div class="donut-mid">
            @if (hoveredDonut(key); as h) {
              <b [style.color]="h.color">{{ h.percent }}%</b>
              <small>{{ h.label }}</small>
            } @else {
              <b>{{ donutTotal(segs) }}</b>
              <small>Total</small>
            }
          </div>
        </div>
        <div class="donut-legend">
          @for (seg of segs; track seg.label) {
            <div class="leg-row" [class.active]="hoveredDonut(key)?.label === seg.label"
                 (mouseenter)="setDonutHover(key, seg)" (mouseleave)="setDonutHover(key, null)">
              <span class="leg-dot" [style.background]="seg.color"></span>{{ seg.label }}
              <b>{{ seg.percent }}% <small>({{ seg.count }})</small></b>
            </div>
          }
        </div>
      } @else {
        <div class="empty">No data yet.</div>
      }
    </ng-template>

    <!-- ---------- Section 3: category performance ("Minds Map") ---------- -->
    <h2 class="sec-title">Minds Map <small class="sec-sub">Question category performance, all-time</small></h2>
    <div class="grid g4-auto" [class.revealed]="revealed()">
      @for (g of gaugeData(); track g.category) {
        <div class="card gauge-card">
          <svg class="gauge" viewBox="0 0 120 120">
            <circle class="gauge-track" cx="60" cy="60" r="50" />
            <circle
              class="gauge-fill"
              cx="60" cy="60" r="50"
              [style.stroke]="g.color"
              [attr.stroke-dasharray]="revealed() ? g.dasharrayFinal : g.dasharrayHidden"
            />
          </svg>
          <div class="gauge-mid">
            <b [style.color]="g.color">{{ g.percent }}%</b>
            <small>{{ g.category }}</small>
          </div>
          <p class="gauge-note">{{ g.correct }} / {{ g.total }} correct</p>
        </div>
      } @empty {
        <div class="card"><div class="empty">No answers recorded yet.</div></div>
      }
    </div>

    <!-- recent registrations / upcoming exams — a compact card list, not a
         table, so nothing needs its own horizontal scrollbar to be read.
         Kept below all the charts/analytics above. -->
    <div class="grid g2" style="margin-top:1rem">
      <div class="card">
        <h3>Recent registrations</h3>
        <div class="item-list">
          @for (r of recent()?.recentRegistrations ?? []; track r.code) {
            <div class="item-row">
              <span class="item-avatar">{{ initials(r.student.name) }}</span>
              <div class="item-main">
                <b>{{ r.student.name }}</b>
                <small>{{ r.competition.title }} &middot; Grade {{ r.student.grade }}</small>
              </div>
              <div class="item-end">
                <span class="bdg" [ngClass]="statusBadge(r.status)">{{ r.status }}</span>
                <small>{{ r.code }}</small>
              </div>
            </div>
          } @empty {
            <div class="empty">No registrations yet.</div>
          }
        </div>
      </div>
      <div class="card">
        <h3>Upcoming exams</h3>
        <div class="item-list">
          @for (e of recent()?.upcomingExams ?? []; track e.code) {
            <div class="item-row">
              <span class="item-avatar ic">&#128197;</span>
              <div class="item-main">
                <b>{{ e.title }}</b>
                <small>{{ e.competition.title }} &middot; Grade {{ e.grade }}</small>
              </div>
              <div class="item-end">
                <span class="bdg" [ngClass]="examBadge(e.status)">{{ e.status }}</span>
                <small>{{ fmtWhen(e) }}</small>
              </div>
            </div>
          } @empty {
            <div class="empty">No upcoming exams.</div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [
    ADMIN_UI_CSS,
    `
    .item-list { display: flex; flex-direction: column; gap: 0.55rem; }
    .item-row { display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 0.65rem; border-radius: 12px;
      background: rgba(255, 255, 255, 0.025); border: 1px solid var(--line, rgba(255,255,255,0.07)); }
    .item-avatar { flex: 0 0 auto; width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center;
      background: rgba(232, 182, 74, 0.14); border: 1px solid rgba(232, 182, 74, 0.35); color: var(--gold-2, #f5cc5a);
      font-weight: 800; font-size: 0.8rem; }
    .item-avatar.ic { font-size: 1rem; background: rgba(59, 130, 246, 0.14); border-color: rgba(59, 130, 246, 0.35); }
    .item-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.1rem; }
    .item-main b { font-size: 0.88rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .item-main small { color: var(--faint, #6e7f9e); font-size: 0.76rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .item-end { flex: 0 0 auto; display: flex; flex-direction: column; align-items: flex-end; gap: 0.25rem; }
    .item-end small { color: var(--faint, #6e7f9e); font-size: 0.7rem; }

    .sec-title { font-size: 1.05rem; font-weight: 800; margin: 1.6rem 0 0.8rem; }
    .sec-sub { color: var(--faint, #6e7f9e); font-weight: 500; font-size: 0.76rem; margin-left: 0.4rem; }
    /* auto-fit instead of a rigid 4-up grid — 3 items (e.g. Minds Map's
       IQ/EQ/Values) stretch to fill the row instead of leaving a gap
       where a 4th card would have gone. */
    .g4-auto { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }

    .stat-link { display: block; cursor: pointer; transition: border-color 0.15s ease, transform 0.15s ease; }
    .stat-link:hover { border-color: var(--gold, #e8b64a); transform: translateY(-2px); }

    .card h3 { display: flex; align-items: baseline; flex-wrap: wrap; gap: 0.3rem; }

    /* a real floating tooltip, not a fixed line of text in the header —
       position: relative anchor for the .chart-tooltip below, which
       tracks the cursor via onChartMouseMove(). */
    .chart-card { position: relative; }
    .chart-tooltip {
      position: absolute; z-index: 30; transform: translate(-50%, calc(-100% - 14px));
      display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; white-space: nowrap;
      background: #0a0f1f; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 9px;
      padding: 0.4rem 0.65rem; font-size: 0.78rem; font-weight: 600; color: var(--text, #eef2fb);
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.45); pointer-events: none;
    }
    /* pointer tail, pointing down at the cursor/data point */
    .chart-tooltip::after {
      content: ""; position: absolute; top: 100%; left: 50%; transform: translateX(-50%);
      border: 6px solid transparent; border-top-color: #0a0f1f;
    }
    .chart-tooltip b { color: var(--gold-2, #f5cc5a); font-weight: 800; margin-left: 0.2rem; }
    .tt-title { display: block; width: 100%; color: var(--faint, #6e7f9e); font-size: 0.68rem; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.05em; margin: -0.1rem 0 0.15rem; }
    .tt-swatch { width: 9px; height: 9px; border-radius: 2px; flex: 0 0 auto; }

    /* ---------- line chart ---------- */
    .line-chart { width: 100%; height: 150px; overflow: visible; }
    .grid-line { stroke: var(--line, rgba(255,255,255,0.07)); stroke-width: 1; }
    .line-fill { fill: rgba(232, 182, 74, 0.12); stroke: none; }
    .line-stroke { fill: none; stroke: var(--gold-2, #f5cc5a); stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round;
      stroke-dasharray: 1; stroke-dashoffset: 1; animation: draw-line 1.4s ease forwards; }
    @keyframes draw-line { to { stroke-dashoffset: 0; } }
    .line-dot { fill: var(--gold-2, #f5cc5a); opacity: 0; animation: dot-in 0.4s ease forwards; animation-delay: 1s;
      transition: r 0.15s ease; pointer-events: none; }
    .line-dot.active { r: 5.5; }
    @keyframes dot-in { to { opacity: 1; } }
    .line-labels { display: flex; justify-content: space-between; margin-top: 0.4rem; color: var(--faint, #6e7f9e); font-size: 0.74rem; }

    /* ---------- multi-line chart (Top 5 Schools) ----------
       No standing legend list at all — which school is which color is
       only ever shown as a small tooltip-style dot + name in the h3's
       .chart-hover while actually hovering that school's line, not as a
       permanent block of 5 names above the chart. */
    .mline-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; vertical-align: middle; margin-right: 0.15rem; }
    .mline-path { fill: none; stroke-width: 2.25; stroke-linecap: round; stroke-linejoin: round;
      stroke-dasharray: 1; stroke-dashoffset: 1; animation: draw-line 1.4s ease forwards;
      transition: opacity 0.15s ease, stroke-width 0.15s ease; }
    .mline-path.dim { opacity: 0.18; }

    /* ---------- bar list (top schools' rank legend, under its line chart) ---------- */
    .bar-list { display: flex; flex-direction: column; gap: 0.7rem; }
    .bar-row { display: flex; align-items: center; gap: 0.7rem; }
    .bar-rank { flex: 0 0 auto; width: 22px; height: 22px; border-radius: 7px; display: grid; place-items: center;
      background: rgba(255, 255, 255, 0.06); font-size: 0.72rem; font-weight: 800; color: var(--muted, #9fb0d0); }
    .bar-body { flex: 1; min-width: 0; }
    .bar-top { display: flex; justify-content: space-between; gap: 0.5rem; font-size: 0.8rem; margin-bottom: 0.28rem; }
    .bar-top b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
    .bar-top span { color: var(--faint, #6e7f9e); flex: 0 0 auto; }
    .bar-track { height: 8px; border-radius: 999px; background: rgba(255, 255, 255, 0.06); overflow: hidden; }
    .bar-fill { height: 100%; border-radius: 999px; width: 0; transition: width 1.1s cubic-bezier(0.22, 1, 0.36, 1); }

    /* ---------- donut ---------- */
    .donut-card { display: flex; flex-direction: column; align-items: center; text-align: center; }
    .donut-wrap { position: relative; width: 128px; height: 128px; margin: 0.3rem auto 0.7rem; }
    .donut-svg { width: 100%; height: 100%; transform: rotate(-90deg); }
    .donut-seg { fill: none; stroke-width: 13; cursor: pointer;
      transition: stroke-dasharray 1s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.15s ease; }
    .donut-seg.dim { opacity: 0.35; }
    .donut-mid { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .donut-mid b { font-family: inherit; font-size: 1.3rem; font-weight: 800; line-height: 1.1; }
    .donut-mid small { color: var(--faint, #6e7f9e); font-size: 0.66rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .donut-legend { display: flex; flex-direction: column; gap: 0.15rem; width: 100%; text-align: left; }
    .leg-row { display: flex; align-items: center; gap: 0.4rem; font-size: 0.76rem; color: var(--muted, #9fb0d0);
      padding: 0.22rem 0.35rem; border-radius: 7px; cursor: pointer; transition: background 0.15s ease; }
    .leg-row:hover, .leg-row.active { background: rgba(255, 255, 255, 0.06); color: var(--text, #eef2fb); }
    .leg-dot { width: 9px; height: 9px; border-radius: 50%; flex: 0 0 auto; }
    .leg-row b { color: var(--text, #eef2fb); margin-left: auto; font-weight: 700; white-space: nowrap; }
    .leg-row b small { color: var(--faint, #6e7f9e); font-weight: 500; }

    /* ---------- category gauge ---------- */
    .gauge-card { display: flex; flex-direction: column; align-items: center; text-align: center; position: relative; }
    .gauge { width: 108px; height: 108px; transform: rotate(-90deg); margin-bottom: 0.4rem; }
    .gauge-track { fill: none; stroke: rgba(255, 255, 255, 0.07); stroke-width: 11; }
    /* stroke-dasharray is intentionally NOT set here — it's driven entirely
       by the [attr.stroke-dasharray] binding in the template. A CSS value
       on this property would silently win over the SVG attribute (CSS
       always beats presentation attributes), freezing the ring at
       whatever this rule said regardless of what the binding computed —
       exactly the bug that made the ring invisible before this comment
       existed. transition still works on attribute-driven changes. */
    .gauge-fill { fill: none; stroke-width: 11; stroke-linecap: round;
      transition: stroke-dasharray 1.2s cubic-bezier(0.22, 1, 0.36, 1); }
    /* top:50px (not 14px) centers this within the 108px-tall gauge SVG —
       14px sat the text right across the ring's own arc stroke near the
       12-o'clock start point, which is what actually looked like doubled/
       garbled text: real text overlapping a curved colored line, not a
       genuine duplicate-render bug. */
    .gauge-mid { position: absolute; top: 50px; left: 0; right: 0; display: flex; flex-direction: column; align-items: center; }
    .gauge-mid b { font-size: 1.5rem; font-weight: 800; line-height: 1.1; }
    .gauge-mid small { color: var(--muted, #9fb0d0); font-size: 0.74rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
    .gauge-note { color: var(--faint, #6e7f9e); font-size: 0.76rem; margin: 0.2rem 0 0; }

    @media (max-width: 900px) {
      .g4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 640px) {
      .g2 { grid-template-columns: 1fr; }
      .g4 { grid-template-columns: 1fr 1fr; }
    }
    `,
  ],
})
export class AdminDashboardPage {
  private readonly api = inject(ApiService);
  readonly s = signal<Summary | null>(null);
  readonly recent = signal<Recent | null>(null);
  readonly a = signal<Analytics | null>(null);
  readonly revealed = signal(false);

  // ---------- chart hover state (used for the floating tooltip on the
  // line charts, and the highlight-swap on the donuts) ----------
  readonly hoveredTrend = signal<{ label: string; count: number; color: string } | null>(null);
  readonly hoveredSchool = signal<{ label: string; count: number; dateLabel: string; color: string } | null>(null);
  // one shared position — only one line chart is ever hovered at a time,
  // so no need to key this per chart. Updated on every mousemove over
  // either chart's <svg>, in CSS pixels relative to that chart's own
  // .chart-card (which is position: relative), so the tooltip genuinely
  // tracks the cursor rather than sitting at a fixed spot in the header.
  readonly tooltipPos = signal<{ x: number; y: number }>({ x: 0, y: 0 });

  /** Cursor position in CSS pixels relative to the hovered chart's own
   * .chart-card (which is position: relative) — this is what the floating
   * tooltip's [style.left.px]/[style.top.px] use, kept separate from the
   * viewBox-space math below since the two charts share one tooltip. */
  private updateTooltipPos(e: MouseEvent, svg: SVGSVGElement): void {
    const card = svg.closest('.chart-card');
    if (!card) return;
    const rect = card.getBoundingClientRect();
    this.tooltipPos.set({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  /** Maps a mouse event to the SVG's own viewBox coordinate space (400x160
   * on both charts here) — needed because preserveAspectRatio="none"
   * stretches the viewBox independently on each axis to fill the
   * rendered box, so a plain clientX/clientY offset would drift off the
   * data as soon as the chart isn't exactly 400x160 CSS pixels. */
  private svgPoint(e: MouseEvent, svg: SVGSVGElement): { x: number; y: number } {
    const rect = svg.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 400,
      y: ((e.clientY - rect.top) / rect.height) * 160,
    };
  }

  /** Registration Trend hover — resolves to the nearest day by X position
   * across the WHOLE chart width, rather than requiring a precise hit on
   * one small dot. This is what makes hovering anywhere along the line —
   * including a steep rising/falling stretch, where the old small
   * per-point hit-circles left dead zones between points — resolve to a
   * tooltip; only the horizontal position matters, never how curved or
   * steep the line is at that spot. */
  onTrendMove(e: MouseEvent): void {
    const svg = e.currentTarget as SVGSVGElement;
    this.updateTooltipPos(e, svg);
    const pts = this.trendPoints();
    if (!pts.length) return;
    const { x } = this.svgPoint(e, svg);
    let nearest = 0;
    let best = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const d = Math.abs(pts[i].x - x);
      if (d < best) {
        best = d;
        nearest = i;
      }
    }
    this.hoveredTrend.set({ label: this.trendDateLabel(nearest), count: pts[nearest].count, color: '#f5cc5a' });
  }

  onTrendLeave(): void {
    this.hoveredTrend.set(null);
  }

  /** Top 5 Schools hover — same nearest-day scanline as the trend chart
   * above, then picks whichever of the (up to 5) series is visually
   * closest to the cursor's Y at that day. That second step is what
   * decides which line/legend lights up regardless of whether that
   * stretch of a curve is flat, steep, or the peak of a spike — the old
   * design hit-tested small circles sitting only exactly ON each data
   * point, so a curve that bowed away from its two neighboring points
   * (the whole point of the smoothed bezier) had real dead zones a
   * cursor could sit in without hitting anything. */
  onSchoolsMove(e: MouseEvent): void {
    const svg = e.currentTarget as SVGSVGElement;
    this.updateTooltipPos(e, svg);
    const series = this.schoolSeries();
    if (!series.length || !series[0].points.length) return;
    const { x, y } = this.svgPoint(e, svg);

    let dayIdx = 0;
    let bestX = Infinity;
    for (let i = 0; i < series[0].points.length; i++) {
      const d = Math.abs(series[0].points[i].x - x);
      if (d < bestX) {
        bestX = d;
        dayIdx = i;
      }
    }

    let chosen = series[0];
    let bestY = Infinity;
    for (const s of series) {
      const d = Math.abs(s.points[dayIdx].y - y);
      if (d < bestY) {
        bestY = d;
        chosen = s;
      }
    }

    const p = chosen.points[dayIdx];
    this.hoveredSchool.set({ label: chosen.label, count: p.count, dateLabel: p.dateLabel, color: chosen.color });
    this.highlightedSchool.set(chosen.label);
  }

  onSchoolsLeave(): void {
    this.hoveredSchool.set(null);
    this.highlightedSchool.set(null);
  }

  // one donut's hover doesn't affect the other three — keyed by chart
  // ('gender' | 'payment' | 'class' | 'city') rather than one shared signal.
  private readonly donutHover = signal<Record<string, DonutSegment | null>>({});

  setDonutHover(key: string, seg: DonutSegment | null): void {
    this.donutHover.set({ ...this.donutHover(), [key]: seg });
  }

  hoveredDonut(key: string): DonutSegment | null {
    return this.donutHover()[key] ?? null;
  }

  constructor() {
    this.api.get<Summary>('/dashboard/summary').subscribe({
      next: (v) => this.s.set(v),
      error: () => undefined,
    });
    this.api.get<Recent>('/dashboard/recent').subscribe({
      next: (v) => this.recent.set(v),
      error: () => undefined,
    });
    this.api.get<Analytics>('/dashboard/analytics').subscribe({
      next: (v) => {
        this.a.set(v);
        // flips the [class.revealed]/[style.width]/[attr.stroke-dasharray]
        // bindings from their "hidden" state to the real data a tick after
        // the charts first paint, so the CSS transitions actually animate
        // instead of jumping straight to the final state.
        setTimeout(() => this.revealed.set(true), 60);
      },
      error: () => undefined,
    });
  }

  statusBadge(status: string) {
    return { Registered: 'blue', 'Test Taken': 'purple', Qualified: 'green', Eliminated: 'red' }[status] ?? 'grey';
  }

  examBadge(status: string) {
    return { Scheduled: 'blue', Live: 'green', Closed: 'red', Draft: 'grey' }[status] ?? 'grey';
  }

  fmtWhen(e: { date: string; time: string }) {
    const d = typeof e.date === 'string' ? e.date.slice(0, 10) : '';
    const t = typeof e.time === 'string' ? e.time.slice(0, 5) : '';
    return `${d}${t ? ' · ' + t : ''}`;
  }

  initials(name: string): string {
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
  }

  formatINR(n: number | undefined): string {
    if (n == null) return '—';
    return '₹' + n.toLocaleString('en-IN');
  }

  // ---------- registration trend (line chart) ----------
  readonly trendPoints = computed(() => {
    const rows = this.a()?.registrationTrend ?? [];
    if (!rows.length) return [];
    const max = Math.max(...rows.map((r) => r.count), 1);
    const stepX = rows.length > 1 ? 400 / (rows.length - 1) : 0;
    return rows.map((r, i) => ({
      x: Math.round(i * stepX),
      y: Math.round(150 - (r.count / max) * 140),
      count: r.count,
      date: r.date,
    }));
  });

  trendPointsStr(): string {
    return this.trendPoints().map((p) => `${p.x},${p.y}`).join(' ');
  }

  areaPoints(): string {
    const pts = this.trendPoints();
    if (!pts.length) return '';
    const line = pts.map((p) => `${p.x},${p.y}`).join(' ');
    return `0,150 ${line} ${pts[pts.length - 1].x},150`;
  }

  trendDateLabel(i: number): string {
    const d = this.trendPoints()[i]?.date;
    if (!d) return '';
    const dt = new Date(d + 'T00:00:00+05:30');
    return dt.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' });
  }

  // ---------- top 5 schools (multi-line chart, daily counts over the
  // last 30 days — same day axis as the registration trend above) ----------
  readonly highlightedSchool = signal<string | null>(null);

  readonly schoolTrendDays = computed(() => {
    const days = this.a()?.topSchoolsTrend?.days ?? [];
    return days.map((d) => {
      // Explicit +05:30 anchor on parse, explicit timeZone on format —
      // these day labels are already "YYYY-MM-DD" in IST from the API;
      // parsing/formatting via the browser's own local timezone instead
      // (the previous behavior) only coincidentally matched for
      // IST-device viewers.
      const dt = new Date(d + 'T00:00:00+05:30');
      return dt.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' });
    });
  });

  readonly schoolSeries = computed(() => {
    const trend = this.a()?.topSchoolsTrend;
    if (!trend || !trend.days.length) return [];
    const dayLabels = this.schoolTrendDays();
    const max = Math.max(...trend.series.flatMap((s) => s.counts), 1);
    const stepX = trend.days.length > 1 ? 400 / (trend.days.length - 1) : 0;
    return trend.series.map((s, i) => {
      const points = s.counts.map((count, di) => ({
        x: Math.round(di * stepX),
        y: Math.round(150 - (count / max) * 130),
        count,
        dateLabel: dayLabels[di] ?? '',
      }));
      return {
        label: s.label,
        color: CHART_COLORS[i % CHART_COLORS.length],
        points,
        path: smoothPath(points),
      };
    });
  });

  // ---------- ratio donuts ----------
  readonly genderDonut = computed(() => toDonut(this.a()?.genderRatio ?? []));
  readonly genderRotations = computed(() => donutRotations(this.a()?.genderRatio ?? []));
  readonly paymentDonut = computed(() => toDonut(this.a()?.paymentStatus ?? []));
  readonly paymentRotations = computed(() => donutRotations(this.a()?.paymentStatus ?? []));
  readonly classDonut = computed(() => toDonut(this.a()?.classRatio ?? []));
  readonly classRotations = computed(() => donutRotations(this.a()?.classRatio ?? []));
  readonly cityDonut = computed(() => toDonut(this.a()?.cityRatio ?? []));
  readonly cityRotations = computed(() => donutRotations(this.a()?.cityRatio ?? []));

  donutTotal(segs: DonutSegment[]): number {
    return segs.reduce((sum, s) => sum + s.count, 0);
  }

  // ---------- Minds Map gauges ----------
  // Pre-baked once per data change rather than calling levelColor()/a
  // dasharray calc as plain template method invocations — those re-run on
  // every change-detection pass (e.g. on every mousemove anywhere on the
  // page, since zone.js triggers CD after any handled event), producing a
  // fresh-but-identical string each time. Angular only skips the actual
  // DOM write when the bound value is reference/value-equal, so this
  // keeps the binding stable instead of technically "changing" every tick.
  private static readonly GAUGE_C = 2 * Math.PI * 50;
  readonly gaugeData = computed(() =>
    (this.a()?.categoryPerformance ?? []).map((c) => {
      const len = (c.percent / 100) * AdminDashboardPage.GAUGE_C;
      return {
        category: c.category,
        percent: c.percent,
        correct: c.correct,
        total: c.total,
        color: levelColor(c.percent),
        dasharrayFinal: `${len} ${AdminDashboardPage.GAUGE_C - len}`,
        dasharrayHidden: `0 ${AdminDashboardPage.GAUGE_C}`,
      };
    }),
  );
}
