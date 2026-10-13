import { NAV } from './admin-shell';

// Every real module an admin account can be granted, with its actual
// human-readable label — flattened straight from the sidebar's own NAV
// structure so this can never drift out of sync with what a code
// actually unlocks (previously a free-text "one code per line" field,
// with the valid codes only documented in a help string underneath).
export const ADMIN_MODULE_OPTIONS: { value: string; label: string }[] = NAV.flatMap((section) =>
  section.items.map((item) => ({ value: item.mod, label: item.label })),
).filter((opt, i, all) => all.findIndex((o) => o.value === opt.value) === i); // a module code can unlock several sidebar entries

export type FieldType =
  | 'text'
  | 'email'
  | 'number'
  | 'select'
  | 'textarea'
  | 'date'
  | 'checkbox'
  | 'password'
  | 'lines'
  | 'indices'
  | 'time'
  | 'student'
  | 'image'
  | 'options'
  | 'richtext'
  | 'checklist';

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  help?: string;
  rows?: number;
  col?: boolean;
  ref?: 'competitions' | 'schools' | 'registrations' | 'grades' | 'question-categories';
  editOnly?: boolean;
  // 'checkbox' only — the value a fresh "Add new" form starts with
  // (resetForm() otherwise always starts every checkbox unchecked).
  defaultChecked?: boolean;
  // 'checklist' only — the fixed set of {value, label} checkboxes to
  // render, so the field never depends on the admin knowing or typing a
  // raw code by hand.
  checklistOptions?: { value: string; label: string }[];
}

export type ColumnType = 'text' | 'badge' | 'date' | 'datetime' | 'time' | 'money' | 'array' | 'boolean' | 'link' | 'richtext';

export interface ColumnDef {
  key: string;
  label: string;
  type?: ColumnType;
  badgeMap?: Record<string, string>;
  money?: boolean;
}

export interface FilterDef {
  key: string;
  label: string;
  options: string[];
  ref?: 'competitions' | 'grades' | 'question-categories' | 'schools';
}

export interface CrudConfig {
  mod: string;
  title: string;
  // Singular form for the "Add X" / "Edit X" modal title — titles aren't
  // all regular plurals (Gallery, News, Payment History), so this can't be
  // derived by just chopping off a trailing "s".
  singular: string;
  base: string;
  createPath?: string;
  keyField?: string;
  columns: ColumnDef[];
  fields: FieldDef[];
  filters?: FilterDef[];
  search?: boolean;
  paginated?: boolean;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  // Extra sentence added to the delete confirmation for a particular row
  // (e.g. a question that belongs to a group), or null for none.
  deleteNote?: (row: Record<string, unknown>) => string | null;
  canView?: boolean;
  // Soft-remove (see Student.archived) instead of/alongside Delete — the
  // row's own `archived` field decides whether the button shows at all;
  // there's no unarchive action.
  canArchive?: boolean;
  profile?: { base: string; title?: string; fields: FieldDef[] };
  // One-off, module-specific kebab-menu actions beyond the generic
  // View/Edit/Archive/Delete set — e.g. "Send Payment Reminder" on
  // Registrations. Each POSTs to `${base}/${row[keyField]}/${endpoint}`;
  // `visible` (default: always) hides it per-row (e.g. only for an unpaid
  // registration). `copyField`, if set, copies that field from the JSON
  // response to the clipboard instead of just toasting successText — e.g.
  // a generated login link the admin needs to paste somewhere (see
  // "Generate Login Link"). `inputPrompt`, if set, opens a small modal
  // asking for one value BEFORE posting (confirmText is skipped — the
  // modal's own Cancel/Submit is the confirmation step) — e.g. typing a
  // new password for "Set Password"; the POST body becomes
  // `{ [inputPrompt.field]: <what they typed> }` instead of empty.
  rowActions?: {
    label: string;
    endpoint: string;
    visible?: (row: Record<string, unknown>) => boolean;
    confirmText?: string;
    successText?: string;
    copyField?: string;
    inputPrompt?: { label: string; field: string; minLength?: number; help?: string };
    // Opens the dedicated merge modal instead of the normal POST flow —
    // `endpoint` above is unused for these. The clicked row is always the
    // duplicate being absorbed; the admin types the code of the record to
    // keep. See admin-crud.page.ts's merge* members and
    // RegistrationService.mergeSchools()/mergeStudents().
    merge?: { noun: string; previewUrl: string; mergeUrl: string };
    // Opens the Magic Link popup (School admin / Coordinator radios) and
    // POSTs {loginAs} to `${base}/${code}/${endpoint}` for a one-click
    // sign-in link. See admin-crud.page.ts loginLink* members.
    loginLink?: boolean;
  }[];
  createText?: string;
  listTransform?: (row: Record<string, unknown>) => Record<string, unknown>;
  createTransform?: (form: Record<string, unknown>) => Record<string, unknown>;
  bulkUpload?: { sampleUrl: string; uploadUrl: string; sampleFilename: string };
  // "Export" button in the toolbar — hits `url` with the page's current
  // search/filters (same params as the list call, minus page/limit) and
  // downloads the response as a file named `filename`.
  export?: { url: string; filename: string; label?: string };
}

const compOptions = (rows: unknown[]): string[] =>
  (rows as Array<{ code: string; title: string }>).map((c) => c.code);

export const CRUD_MODULES: Record<string, CrudConfig> = {
  prize: {
    mod: 'prize',
    title: 'Prizes & Awards',
    singular: 'Prize',
    base: '/prizes',
    paginated: false,
    search: false,
    filters: [{ key: 'comp', label: 'Competition', options: [], ref: 'competitions' }],
    columns: [
      { key: 'rankLabel', label: 'Rank', type: 'badge', badgeMap: { '1st': 'gold', '2nd': 'blue', '3rd': 'purple', Consolation: 'grey' } },
      { key: 'competition', label: 'Competition' },
      { key: 'money', label: 'Prize', money: true },
      { key: 'award', label: 'Award' },
      { key: 'note', label: 'Note' },
    ],
    fields: [
      { key: 'competitionCode', label: 'Competition', type: 'select', required: true, ref: 'competitions' },
      { key: 'rankLabel', label: 'Rank', type: 'select', required: true, options: ['1st', '2nd', '3rd', 'Consolation'] },
      { key: 'money', label: 'Prize amount (₹)', type: 'number' },
      { key: 'award', label: 'Award (Trophy/Medal…)', type: 'text' },
      { key: 'note', label: 'Note', type: 'text' },
    ],
    canCreate: true,
    canEdit: true,
    canDelete: true,
  },
  reg: {
    mod: 'reg',
    title: 'Registrations',
    singular: 'Registration',
    base: '/registrations',
    filters: [
      { key: 'comp', label: 'Competition', options: [], ref: 'competitions' },
      // "Archived" is a synthetic value the backend treats specially — it
      // filters by the STUDENT's archived flag rather than a real
      // Registration.status. Every other option (and no filter at all)
      // already excludes archived students from the list.
      { key: 'status', label: 'Status', options: ['Registered', 'Test Taken', 'Qualified', 'Eliminated', 'Archived'] },
      { key: 'school', label: 'School', options: [], ref: 'schools' },
      { key: 'grade', label: 'Class', options: [], ref: 'grades' },
      // Distinct from the Status filter above — this is whether a Paid
      // payment exists on the registration, not the registration's own
      // lifecycle status (see RegistrationService.buildRegistrationWhere).
      { key: 'paymentStatus', label: 'Payment', options: ['Paid', 'Unpaid'] },
    ],
    export: { url: '/registrations/export', filename: 'registrations-export.xlsx', label: 'Export Excel' },
    columns: [
      { key: 'code', label: 'Code', type: 'badge', badgeMap: { R1001: 'grey' } },
      { key: 'name', label: 'Student' },
      { key: 'grade', label: 'Grade' },
      { key: 'school', label: 'School' },
      { key: 'competition', label: 'Competition' },
      { key: 'status', label: 'Status', type: 'badge', badgeMap: { Registered: 'blue', 'Test Taken': 'purple', Qualified: 'green', Eliminated: 'red' } },
      { key: 'paid', label: 'Payment', type: 'badge', badgeMap: { Paid: 'green' } },
      { key: 'registeredAt', label: 'Registered', type: 'datetime' },
    ],
    fields: [
      { key: 'competitionCode', label: 'Competition', type: 'select', required: true, ref: 'competitions' },
      { key: 'name', label: 'Student name', type: 'text', required: true },
      { key: 'grade', label: 'Grade', type: 'select', required: true, ref: 'grades' },
      { key: 'email', label: 'Student email', type: 'email', col: true },
      { key: 'phone', label: 'Student phone', type: 'text', col: true },
      { key: 'schoolCode', label: 'School', type: 'select', ref: 'schools' },
      { key: 'parent', label: 'Parent / guardian', type: 'text', col: true },
    ],
    canCreate: true,
    canEdit: false,
    canDelete: true,
    canArchive: true,
    canView: true,
    rowActions: [
      {
        label: 'Send Payment Reminder',
        endpoint: 'payment-reminder',
        visible: (row) => row['paid'] !== 'Paid',
        confirmText: 'Send a payment reminder email to this student?',
        successText: 'Reminder sent',
      },
      {
        label: 'Generate Login Link',
        endpoint: 'access-token',
        confirmText:
          'Generate a direct-login link for this student? This bypasses OTP entirely — anyone with the link can sign in as them. Regenerating invalidates any link generated before it.',
        successText: 'Login link copied to clipboard',
        copyField: 'loginUrl',
      },
      {
        label: 'Set Password',
        endpoint: 'set-student-password',
        inputPrompt: {
          label: 'New password for this student',
          field: 'newPassword',
          minLength: 6,
          help: 'At least 6 characters. Takes effect immediately — no confirmation email or current-password check.',
        },
        successText: 'Password set',
      },
      {
        label: 'Merge into…',
        endpoint: '',
        merge: { noun: 'student', previewUrl: '/students/merge-preview', mergeUrl: '/students/merge' },
      },
    ],
    profile: {
      base: '/students',
      title: 'Student Profile',
      fields: [
        { key: 'name', label: 'Student name', type: 'text', required: true },
        { key: 'grade', label: 'Grade', type: 'select', required: true, ref: 'grades' },
        { key: 'email', label: 'Student email', type: 'email', col: true },
        { key: 'phone', label: 'Student phone', type: 'text', col: true },
        { key: 'parent', label: 'Parent / guardian', type: 'text', col: true },
        { key: 'schoolCode', label: 'School', type: 'select', ref: 'schools', col: true },
      ],
    },
    createText: 'New registration',
    bulkUpload: {
      sampleUrl: '/registrations/bulk-upload/sample',
      uploadUrl: '/registrations/bulk-upload',
      sampleFilename: 'registrations-sample.csv',
    },
    createTransform: (f) => ({
      competitionCode: f['competitionCode'],
      student: {
        name: f['name'],
        grade: f['grade'],
        email: f['email'],
        phone: f['phone'],
        schoolCode: f['schoolCode'],
        parent: f['parent'],
      },
    }),
  },
  pay: {
    mod: 'pay',
    title: 'Payment History',
    singular: 'Payment',
    base: '/payments',
    filters: [
      { key: 'comp', label: 'Competition', options: [], ref: 'competitions' },
      { key: 'status', label: 'Status', options: ['Pending', 'Paid', 'Failed'] },
      { key: 'school', label: 'School', options: [], ref: 'schools' },
      { key: 'grade', label: 'Class', options: [], ref: 'grades' },
    ],
    export: { url: '/payments/export', filename: 'payments-export.xlsx', label: 'Export Excel' },
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'student', label: 'Student' },
      { key: 'school', label: 'School' },
      { key: 'stage', label: 'Stage' },
      { key: 'amount', label: 'Amount', money: true },
      { key: 'mode', label: 'Mode' },
      { key: 'status', label: 'Status', type: 'badge', badgeMap: { Paid: 'green', Pending: 'gold', Failed: 'red' } },
      { key: 'paidAt', label: 'Paid', type: 'datetime' },
    ],
    fields: [
      { key: 'registrationCode', label: 'Registration', type: 'select', required: true, ref: 'registrations' },
      { key: 'amount', label: 'Amount (₹)', type: 'number', required: true },
      { key: 'mode', label: 'Mode', type: 'select', required: true, options: ['UPI', 'Card', 'Net Banking', 'Offline'] },
      { key: 'status', label: 'Status', type: 'select', options: ['Pending', 'Paid', 'Failed'] },
      { key: 'providerTxn', label: 'Provider TXN id', type: 'text' },
    ],
    canCreate: true,
    canEdit: true,
    canDelete: false,
    createText: 'Record payment',
  },
  sch: {
    mod: 'sch',
    title: 'Schools',
    singular: 'School',
    base: '/schools',
    filters: [{ key: 'status', label: 'Status', options: ['Verified', 'Unverified'] }],
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'School' },
      { key: 'verifiedLabel', label: 'Status', type: 'badge', badgeMap: { Verified: 'green', Unverified: 'gold' } },
      { key: 'city', label: 'City' },
      { key: 'contact', label: 'Primary Phone' },
      { key: 'contactSecondary', label: 'Secondary Phone' },
      { key: 'schoolEmail', label: "School's email" },
      { key: 'coordinator', label: 'Coordinator' },
      { key: 'email', label: 'Coordinator login' },
      { key: 'students', label: 'Students', money: false },
    ],
    fields: [
      { key: 'name', label: 'School name', type: 'text', required: true },
      {
        key: 'verified',
        label: 'Verified',
        type: 'checkbox',
        defaultChecked: true,
        help: 'On for every school an admin adds — off means a student typed this name at registration and nobody has reviewed it yet (check it isn\'t a duplicate/typo of an existing school before marking it verified).',
      },
      { key: 'city', label: 'City', type: 'text', col: true },
      {
        key: 'contact',
        label: 'Primary Phone',
        type: 'text',
        col: true,
        help: "The school office's main contact number.",
      },
      {
        key: 'contactSecondary',
        label: 'Secondary Phone',
        type: 'text',
        col: true,
        help: 'Optional — an alternate number, if the school has one.',
      },
      {
        key: 'schoolEmail',
        label: "School's email",
        type: 'email',
        col: true,
        help: "The institution's own address (front office, info@…) — used for the \"All Schools\" mass email audience. Separate from the coordinator's personal login email below.",
      },
      {
        key: 'coordinator',
        label: 'Coordinator name',
        type: 'text',
        col: true,
        help: "The person who signs in to this school's portal — their name, email and phone below are one identity.",
      },
      {
        key: 'email',
        label: 'Coordinator email',
        type: 'email',
        col: true,
        help: 'Used to sign in at /schools, and to receive the verification code on first login.',
      },
      {
        key: 'phone',
        label: 'Coordinator phone',
        type: 'text',
        col: true,
        help: "Also this school's login password until the coordinator sets a real one — the phone number itself, verified by a code sent here and to the email above on first login.",
      },
    ],
    canCreate: true,
    canEdit: true,
    canDelete: false,
    canView: true,
    createText: 'Add school',
    bulkUpload: {
      sampleUrl: '/schools/bulk-upload/sample',
      uploadUrl: '/schools/bulk-upload',
      sampleFilename: 'schools-sample.csv',
    },
    rowActions: [
      {
        label: 'Set Password',
        endpoint: 'set-password',
        inputPrompt: {
          label: 'New password for this school',
          field: 'newPassword',
          minLength: 6,
          help: 'At least 6 characters. Takes effect immediately, and clears "must change password" — no confirmation email or current-password check.',
        },
        successText: 'Password set',
      },
      {
        label: 'Magic Link',
        endpoint: 'login-link',
        loginLink: true,
      },
      {
        label: 'Merge into…',
        endpoint: '',
        merge: { noun: 'school', previewUrl: '/schools/merge-preview', mergeUrl: '/schools/merge' },
      },
    ],
  },
  gr: {
    mod: 'gr',
    title: 'Classes & Grades',
    singular: 'Grade',
    base: '/grades',
    keyField: 'name',
    search: true,
    columns: [
      { key: 'name', label: 'Grade / Class' },
      { key: 'position', label: 'Order' },
      { key: 'active', label: 'Active', type: 'boolean' },
    ],
    fields: [
      { key: 'name', label: 'Grade / Class (e.g. 9, 9-12)', type: 'text', required: true },
      { key: 'position', label: 'Sort order', type: 'number' },
      { key: 'active', label: 'Active', type: 'checkbox' },
    ],
    canCreate: true,
    canEdit: true,
    canDelete: true,
    createText: 'Add grade',
  },
  qc: {
    mod: 'qc',
    title: 'Question Categories',
    singular: 'Question Category',
    base: '/question-categories',
    keyField: 'name',
    search: true,
    columns: [
      { key: 'name', label: 'Category' },
      { key: 'position', label: 'Order' },
      { key: 'active', label: 'Active', type: 'boolean' },
    ],
    fields: [
      { key: 'name', label: 'Category (e.g. IQ, EQ, Values)', type: 'text', required: true },
      { key: 'position', label: 'Sort order', type: 'number' },
      { key: 'active', label: 'Active', type: 'checkbox' },
    ],
    canCreate: true,
    canEdit: true,
    canDelete: true,
    createText: 'Add category',
  },
  q: {
    mod: 'q',
    title: 'Question Bank',
    singular: 'Question',
    base: '/questions',
    filters: [
      { key: 'comp', label: 'Competition', options: [], ref: 'competitions' },
      { key: 'category', label: 'Category', options: [], ref: 'question-categories' },
      { key: 'grade', label: 'Grade', options: [], ref: 'grades' },
      { key: 'demo', label: 'Demo', options: ['Demo only', 'Real only'] },
      { key: 'group', label: 'Group', options: ['Grouped', 'Ungrouped'] },
    ],
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'prompt', label: 'Question', type: 'richtext' },
      // Set when the question is a sub-question of a Question Group (Content > Question Groups).
      { key: 'groupCode', label: 'Group' },
      { key: 'category', label: 'Category', type: 'badge', badgeMap: { IQ: 'blue', EQ: 'purple', Values: 'pink' } },
      { key: 'grade', label: 'Grade' },
      { key: 'qtype', label: 'Type', type: 'badge', badgeMap: { text: 'grey', video: 'purple', image: 'gold' } },
      { key: 'competition', label: 'Competition' },
    ],
    fields: [
      { key: 'prompt', label: 'Question Text', type: 'richtext', required: true, help: 'The actual question shown to the student. Use the toolbar for bullets, numbering, and indentation.' },
      { key: 'qtype', label: 'Type', type: 'select', options: ['text', 'video', 'image'], col: true },
      { key: 'mode', label: 'Answer Mode', type: 'select', options: ['single', 'multi'], col: true },
      { key: 'media', label: 'Media (for image/video questions)', type: 'image' },
      { key: 'options', label: 'Answer Options', type: 'options', required: true, help: 'Add each option, then mark the correct one(s).' },
      { key: 'category', label: 'Category', type: 'select', required: true, ref: 'question-categories', col: true },
      { key: 'grade', label: 'Grade', type: 'select', required: true, ref: 'grades', col: true },
      { key: 'competitionCode', label: 'Competition', type: 'select', ref: 'competitions', col: true },
      { key: 'timeLimitSecs', label: 'Time limit (secs)', type: 'number', col: true },
      { key: 'label', label: 'Internal label', type: 'text', col: true, help: 'Optional short tag for admin use only.' },
      {
        key: 'isDemo',
        label: 'Demo question',
        type: 'checkbox',
        help: 'Only ever served by the public Default Demo Exam — strictly excluded from every real exam, regardless of Competition.',
      },
    ],
    canCreate: true,
    canEdit: true,
    canDelete: true,
    deleteNote: (row) =>
      row['groupCode']
        ? `It is part of question group ${row['groupCode']}. Deleting it removes it from that group, and if that leaves the group with fewer than 2 questions the group is switched off.`
        : null,
    createText: 'Add question',
    createTransform: (f) => {
      const rows = (f['options'] as { text: string; correct: boolean }[]) ?? [];
      // Filter blanks once, then derive both arrays from that same filtered
      // list — deriving `correct` from the original (unfiltered) indices
      // would drift as soon as a blank row sat before a correct one.
      const kept = rows.filter((r) => r.text?.trim());
      const options = kept.map((r) => r.text.trim());
      const correct = kept.reduce<number[]>((acc, r, i) => {
        if (r.correct) acc.push(i);
        return acc;
      }, []);
      return { ...f, options, correct };
    },
    bulkUpload: {
      sampleUrl: '/questions/bulk-upload/sample',
      uploadUrl: '/questions/bulk-upload',
      sampleFilename: 'questions-sample.csv',
    },
  },
  ex: {
    mod: 'ex',
    title: 'Exam Dates',
    singular: 'Exam Date',
    base: '/exams',
    filters: [
      { key: 'comp', label: 'Competition', options: [], ref: 'competitions' },
      { key: 'status', label: 'Status', options: ['Draft', 'Scheduled', 'Live', 'Closed'] },
    ],
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'title', label: 'Exam' },
      { key: 'grade', label: 'Grade' },
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'time', label: 'Time', type: 'time' },
      { key: 'durationMin', label: 'Min' },
      { key: 'questionsServed', label: 'Qs' },
      { key: 'maxAttempts', label: 'Max Attempts' },
      { key: 'status', label: 'Status', type: 'badge', badgeMap: { Draft: 'grey', Scheduled: 'blue', Live: 'green', Closed: 'red' } },
    ],
    fields: [
      { key: 'competitionCode', label: 'Competition', type: 'select', ref: 'competitions' },
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'grade', label: 'Grade band', type: 'select', ref: 'grades', col: true },
      { key: 'date', label: 'Date', type: 'date', col: true },
      { key: 'time', label: 'Start time', type: 'time', col: true },
      { key: 'durationMin', label: 'Duration (min)', type: 'number', col: true },
      {
        key: 'questionCount',
        label: 'Questions per student',
        type: 'number',
        col: true,
        help: 'Random questions drawn from the competition pool each attempt; leave blank to serve every matching question. Ignored when the competition has a Question mix (Competitions > Stages & qualifiers > Question mix) — the mix total is used instead, and the Qs column shows it as "N (mix)".',
      },
      {
        key: 'maxAttempts',
        label: 'Max attempts',
        type: 'number',
        col: true,
        help: 'How many times a student may take this exam (default 1). A re-attempt gets a fresh set of questions that excludes whatever their previous attempt served, and that previous attempt is removed once the new one is submitted.',
      },
      { key: 'status', label: 'Status', type: 'select', options: ['Draft', 'Scheduled', 'Live', 'Closed'] },
    ],
    canCreate: true,
    canEdit: true,
    canDelete: true,
    createText: 'Add exam',
  },
  gri: {
    mod: 'gri',
    title: 'Grievances',
    singular: 'Grievance',
    base: '/grievances',
    search: true,
    filters: [
      { key: 'status', label: 'Status', options: ['New', 'In Progress', 'Resolved'] },
      { key: 'gtype', label: 'Type', options: ['Complaint', 'Feedback', 'Suggestion'] },
    ],
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'gtype', label: 'Type', type: 'badge', badgeMap: { Complaint: 'red', Feedback: 'green', Suggestion: 'blue' } },
      { key: 'name', label: 'From' },
      { key: 'subject', label: 'Subject' },
      { key: 'status', label: 'Status', type: 'badge', badgeMap: { New: 'gold', 'In Progress': 'blue', Resolved: 'green' } },
      { key: 'createdAt', label: 'Received', type: 'datetime' },
    ],
    fields: [{ key: 'status', label: 'Status', type: 'select', required: true, options: ['New', 'In Progress', 'Resolved'] }],
    canCreate: false,
    canEdit: true,
    canDelete: false,
  },
  nt: {
    mod: 'nt',
    title: 'Notifications',
    singular: 'Notification',
    base: '/notifications',
    createPath: '/notifications/send',
    keyField: 'id',
    search: false,
    filters: [{ key: 'status', label: 'Status', options: ['Draft', 'Sent', 'Failed'] }],
    columns: [
      { key: 'id', label: '#' },
      { key: 'channel', label: 'Channel', type: 'badge', badgeMap: { EMAIL: 'blue', SMS: 'pink' } },
      { key: 'audience', label: 'Audience' },
      { key: 'subject', label: 'Subject' },
      { key: 'status', label: 'Status', type: 'badge', badgeMap: { Draft: 'grey', Sent: 'green', Failed: 'red' } },
      { key: 'sentAt', label: 'Sent', type: 'datetime' },
    ],
    fields: [
      { key: 'channel', label: 'Channel', type: 'select', required: true, options: ['EMAIL', 'SMS'] },
      { key: 'audience', label: 'Audience', type: 'select', required: true, options: ['All', 'All Registered', 'Qualified only', 'Schools'] },
      { key: 'competitionCode', label: 'Competition', type: 'select', ref: 'competitions' },
      { key: 'subject', label: 'Subject', type: 'text' },
      { key: 'message', label: 'Message', type: 'textarea', required: true, rows: 4 },
    ],
    canCreate: true,
    canEdit: false,
    canDelete: false,
    createText: 'Send notification',
  },
  faq: {
    mod: 'faq',
    title: 'FAQs',
    singular: 'FAQ',
    base: '/faqs',
    search: true,
    filters: [{ key: 'status', label: 'Status', options: ['Active', 'Inactive'] }],
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'question', label: 'Question' },
      { key: 'position', label: 'Order' },
      { key: 'active', label: 'Active', type: 'boolean' },
    ],
    fields: [
      { key: 'question', label: 'Question', type: 'textarea', rows: 2, required: true },
      { key: 'answer', label: 'Answer', type: 'textarea', rows: 4, required: true },
      { key: 'position', label: 'Sort order', type: 'number', col: true, help: 'Lower numbers show first on the public FAQ page.' },
      { key: 'active', label: 'Active', type: 'checkbox', col: true, defaultChecked: true, help: 'Off hides it from the public site without deleting it.' },
    ],
    canCreate: true,
    canEdit: true,
    canDelete: true,
    createText: 'Add FAQ',
  },
  ann: {
    mod: 'ann',
    title: 'Announcements',
    singular: 'Announcement',
    base: '/announcements',
    filters: [{ key: 'status', label: 'Status', options: ['Draft', 'Active'] }],
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'title', label: 'Title' },
      { key: 'category', label: 'Category', type: 'badge', badgeMap: { Exam: 'blue', Event: 'gold', Results: 'green' } },
      { key: 'audience', label: 'Audience' },
      { key: 'pinned', label: 'Pinned', type: 'boolean' },
      { key: 'status', label: 'Status', type: 'badge', badgeMap: { Draft: 'grey', Active: 'green' } },
    ],
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'category', label: 'Category', type: 'text', col: true },
      { key: 'audience', label: 'Audience', type: 'text', col: true },
      { key: 'publishOn', label: 'Publish date', type: 'date', col: true },
      { key: 'status', label: 'Status', type: 'select', options: ['Draft', 'Active'], col: true },
      { key: 'pinned', label: 'Pinned on home', type: 'checkbox', col: true },
      { key: 'message', label: 'Message', type: 'textarea', rows: 3 },
    ],
    canCreate: true,
    canEdit: true,
    canDelete: true,
    createText: 'New announcement',
  },
  news: {
    mod: 'news',
    title: 'News',
    singular: 'Article',
    base: '/news',
    filters: [{ key: 'status', label: 'Status', options: ['Draft', 'Published'] }],
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'title', label: 'Title' },
      { key: 'category', label: 'Category' },
      { key: 'author', label: 'Author' },
      { key: 'publishOn', label: 'Published', type: 'date' },
      { key: 'status', label: 'Status', type: 'badge', badgeMap: { Draft: 'grey', Published: 'green' } },
    ],
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'category', label: 'Category', type: 'text', col: true },
      { key: 'author', label: 'Author', type: 'text', col: true },
      { key: 'publishOn', label: 'Publish date', type: 'date', col: true },
      { key: 'status', label: 'Status', type: 'select', options: ['Draft', 'Published'], col: true },
      { key: 'photo', label: 'Photo', type: 'image' },
      { key: 'summary', label: 'Summary', type: 'textarea', rows: 3 },
    ],
    canCreate: true,
    canEdit: true,
    canDelete: true,
    createText: 'New article',
  },
  gal: {
    mod: 'gal',
    title: 'Gallery',
    singular: 'Album',
    base: '/gallery',
    filters: [
      { key: 'status', label: 'Status', options: ['Active', 'Inactive'] },
      { key: 'visibility', label: 'Visibility', options: ['Public', 'Private'] },
    ],
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Album' },
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'visibility', label: 'Visibility', type: 'badge', badgeMap: { Public: 'green', Private: 'grey' } },
      { key: 'status', label: 'Status', type: 'badge', badgeMap: { Active: 'green', Inactive: 'grey' } },
    ],
    fields: [
      { key: 'name', label: 'Album name', type: 'text', required: true },
      { key: 'date', label: 'Date', type: 'date', col: true },
      { key: 'visibility', label: 'Visibility', type: 'select', options: ['Public', 'Private'], col: true },
      { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'], col: true },
      { key: 'cover', label: 'Cover image', type: 'image' },
      { key: 'description', label: 'Description', type: 'textarea', rows: 3 },
    ],
    canCreate: true,
    canEdit: true,
    canDelete: true,
    createText: 'New album',
  },
  spon: {
    mod: 'spon',
    title: 'Sponsors',
    singular: 'Sponsor',
    base: '/sponsors',
    filters: [{ key: 'tier', label: 'Tier', options: ['Gold', 'Silver', 'Bronze'] }],
    columns: [
      { key: 'name', label: 'Sponsor', type: 'link' },
      { key: 'contact', label: 'Contact' },
      { key: 'email', label: 'Email' },
      { key: 'tier', label: 'Tier', type: 'badge', badgeMap: { Gold: 'gold', Silver: 'grey', Bronze: 'purple' } },
      { key: 'amount', label: 'Contribution', money: true },
      { key: 'status', label: 'Status', type: 'badge', badgeMap: { Active: 'green', Pending: 'gold', Disabled: 'red' } },
    ],
    fields: [
      { key: 'name', label: 'Sponsor name', type: 'text', required: true },
      { key: 'contact', label: 'Contact person', type: 'text', col: true },
      { key: 'email', label: 'Email', type: 'email', col: true },
      { key: 'phone', label: 'Phone', type: 'text', col: true },
      { key: 'tier', label: 'Tier', type: 'select', options: ['Gold', 'Silver', 'Bronze'], col: true },
      { key: 'amount', label: 'Contribution (₹)', type: 'number', col: true },
      { key: 'since', label: 'Since (year)', type: 'text', col: true, placeholder: '2026' },
      { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Pending', 'Disabled'], col: true },
      { key: 'competitionCodes', label: 'Sponsored competitions', type: 'lines', ref: 'competitions', help: 'Competition codes, one per line' },
    ],
    canCreate: true,
    canEdit: true,
    canDelete: true,
    createText: 'Add sponsor',
    createTransform: (f) => {
      const codes = (f['competitionCodes'] as string[]) ?? [];
      return { ...f, competitionCodes: codes };
    },
  },
  plan: {
    mod: 'plan',
    title: 'Sponsorship Plans',
    singular: 'Plan',
    base: '/plans',
    search: true,
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Plan' },
      { key: 'minAmount', label: 'Minimum', money: true },
      { key: 'benefits', label: 'Benefits' },
      { key: 'active', label: 'Active', type: 'boolean' },
    ],
    fields: [
      { key: 'name', label: 'Plan name', type: 'text', required: true },
      { key: 'minAmount', label: 'Minimum contribution (₹)', type: 'number', required: true },
      { key: 'benefits', label: 'Benefits', type: 'textarea', rows: 3 },
      { key: 'active', label: 'Active', type: 'checkbox' },
    ],
    canCreate: true,
    canEdit: true,
    canDelete: true,
    createText: 'Add plan',
  },
  ad: {
    mod: 'ad',
    title: 'Admin Users',
    singular: 'Admin User',
    base: '/admins',
    keyField: 'id',
    search: true,
    filters: [{ key: 'status', label: 'Status', options: ['Active', 'Disabled'] }],
    columns: [
      { key: 'name', label: 'Admin' },
      { key: 'email', label: 'Email' },
      { key: 'role', label: 'Role', type: 'badge', badgeMap: { 'Super Admin': 'gold', Editor: 'blue', Viewer: 'grey' } },
      { key: 'status', label: 'Status', type: 'badge', badgeMap: { Active: 'green', Disabled: 'red' } },
      { key: 'modules', label: 'Modules', type: 'array' },
    ],
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'email', label: 'Email', type: 'email', required: true },
      // NOT editOnly — that flag (see AdminCrudPage.formFields()) means
      // "only show while editing", which is backwards for a password field
      // that needs to be visible on BOTH create (required) and edit
      // (optional — a blank value is dropped from the payload by the
      // generic empty-string skip in payload() below, so it never
      // overwrites the existing hash). That mismatch previously hid this
      // field in both modes — there was no way to set a password at all.
      { key: 'password', label: 'Password (6+ chars)', type: 'password', help: 'Required on create; leave blank to keep on edit' },
      { key: 'role', label: 'Role', type: 'select', options: ['Super Admin', 'Editor', 'Viewer'] },
      { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Disabled'] },
      {
        key: 'modules',
        label: 'Module access',
        type: 'checklist',
        checklistOptions: ADMIN_MODULE_OPTIONS,
        help: 'Which admin sections this account can see and use.',
      },
    ],
    canCreate: true,
    canEdit: true,
    canDelete: true,
    createText: 'Add admin',
    createTransform: (f) => {
      const modules = (f['modules'] as string[]) ?? [];
      return { ...f, modules };
    },
  },
};
