import type { RegistrationView } from './student-data.service';
import { formatINR } from './format';

export interface JourneyStep {
  name: string;
  num: number;
  state: 'done' | 'active' | 'locked';
  sub?: string;
}

export interface NextAction {
  kind: 'pay' | 'open' | 'done';
  title: string;
  text: string;
  cta: string;
  href: string;
}

export function journeyStepsFor(reg: RegistrationView): JourneyStep[] {
  return reg.stages.map((rs) => {
    const s = rs.status;
    const base = { name: rs.stage.name, num: rs.stage.position };
    if (s === 'Qualified' || s === 'Attempted') {
      return { ...base, state: 'done' as const };
    }
    if (s === 'Unlocked' || s === 'Paid') {
      return { ...base, state: 'active' as const };
    }
    if (s === 'Eliminated') {
      return { ...base, state: 'locked' as const, sub: 'Eliminated' };
    }
    if (s === 'Locked' && !rs.stage.isFree) {
      return { ...base, state: 'locked' as const, sub: 'Payment pending' };
    }
    return { ...base, state: 'locked' as const };
  });
}

export function journeyProgressFor(reg: RegistrationView): number {
  const steps = journeyStepsFor(reg);
  if (!steps.length) return 0;
  const done = steps.filter((s) => s.state === 'done').length;
  const active = steps.some((s) => s.state === 'active') ? 1 : 0;
  return Math.min(100, Math.round(((done + active) / steps.length) * 100));
}

export function nextActionFor(reg: RegistrationView): NextAction | null {
  const stages = reg.stages;
  if (!stages.length) return null;

  // Registration itself isn't confirmed until stage 1 is paid — this needs to
  // surface even before the student has qualified for anything.
  const first = stages[0];
  if (first.status === 'Locked' && !first.stage.isFree) {
    return {
      kind: 'pay',
      title: 'Pay to confirm your registration',
      text: `Pay ${formatINR(first.stage.price)} to confirm your registration and unlock ${first.stage.name}. Payments are recorded via your school coordinator.`,
      cta: 'Pay Now →',
      href: '/account/payments',
    };
  }

  let qualifiedIdx = -1;
  for (let i = 0; i < stages.length; i++) {
    if (stages[i].status === 'Qualified') qualifiedIdx = i;
  }
  if (qualifiedIdx === -1) return null;
  const next = stages[qualifiedIdx + 1];
  if (!next) {
    return {
      kind: 'done',
      title: 'Competition complete',
      text: `You cleared every stage of ${reg.competition.title}. Keep an eye out for the awards ceremony!`,
      cta: '',
      href: '',
    };
  }
  if (next.status === 'Unlocked' || next.status === 'Paid') {
    return {
      kind: 'open',
      title: `Stage ${next.stage.position} is open`,
      text: `You're cleared for ${next.stage.name}. Check your schedule for the next session.`,
      cta: 'View schedules →',
      href: '/account/schedules',
    };
  }
  if (next.stage.isFree) {
    return {
      kind: 'open',
      title: `Stage ${next.stage.position} unlocked`,
      text: `Next up: ${next.stage.name}. Your spot is confirmed — check your schedule.`,
      cta: 'View schedules →',
      href: '/account/schedules',
    };
  }
  return {
    kind: 'pay',
    title: `Pay to unlock Stage ${next.stage.position}`,
    text: `You qualified for ${next.stage.name}. Pay ${formatINR(next.stage.price)} to confirm your place for the next stage. Payments are recorded via your school coordinator.`,
    cta: 'Payment history →',
    href: '/account/payments',
  };
}
