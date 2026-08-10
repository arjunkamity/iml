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
  | 'student';

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
  ref?: 'competitions' | 'schools' | 'registrations';
  editOnly?: boolean;
}

export type ColumnType = 'text' | 'badge' | 'date' | 'datetime' | 'money' | 'array' | 'boolean' | 'link';

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
  ref?: 'competitions';
}

export interface CrudConfig {
  mod: string;
  title: string;
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
  createText?: string;
  listTransform?: (row: Record<string, unknown>) => Record<string, unknown>;
  createTransform?: (form: Record<string, unknown>) => Record<string, unknown>;
}

const compOptions = (rows: unknown[]): string[] =>
  (rows as Array<{ code: string; title: string }>).map((c) => c.code);

export const CRUD_MODULES: Record<string, CrudConfig> = {
  prize: {
    mod: 'prize',
    title: 'Prizes & Awards',
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
    base: '/registrations',
    filters: [
      { key: 'comp', label: 'Competition', options: [], ref: 'competitions' },
      { key: 'status', label: 'Status', options: ['Registered', 'Test Taken', 'Qualified', 'Eliminated'] },
    ],
    columns: [
      { key: 'code', label: 'Code', type: 'badge', badgeMap: { R1001: 'grey' } },
      { key: 'name', label: 'Student' },
      { key: 'grade', label: 'Grade' },
      { key: 'school', label: 'School' },
      { key: 'competition', label: 'Competition' },
      { key: 'status', label: 'Status', type: 'badge', badgeMap: { Registered: 'blue', 'Test Taken': 'purple', Qualified: 'green', Eliminated: 'red' } },
      { key: 'registeredAt', label: 'Registered', type: 'datetime' },
    ],
    fields: [
      { key: 'competitionCode', label: 'Competition', type: 'select', required: true, ref: 'competitions' },
      { key: 'name', label: 'Student name', type: 'text', required: true },
      { key: 'grade', label: 'Grade', type: 'text', required: true, placeholder: 'e.g. 9' },
      { key: 'email', label: 'Student email', type: 'email', col: true },
      { key: 'phone', label: 'Student phone', type: 'text', col: true },
      { key: 'schoolCode', label: 'School', type: 'select', ref: 'schools' },
      { key: 'parent', label: 'Parent / guardian', type: 'text', col: true },
    ],
    canCreate: true,
    canEdit: false,
    canDelete: true,
    createText: 'New registration',
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
    base: '/payments',
    filters: [
      { key: 'comp', label: 'Competition', options: [], ref: 'competitions' },
      { key: 'status', label: 'Status', options: ['Pending', 'Paid', 'Failed'] },
    ],
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'student', label: 'Student' },
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
    base: '/schools',
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'School' },
      { key: 'city', label: 'City' },
      { key: 'contact', label: 'Contact' },
      { key: 'coordinator', label: 'Coordinator' },
      { key: 'students', label: 'Students', money: false },
    ],
    fields: [
      { key: 'name', label: 'School name', type: 'text', required: true },
      { key: 'city', label: 'City', type: 'text', col: true },
      { key: 'contact', label: 'Contact', type: 'text', col: true },
      { key: 'coordinator', label: 'Coordinator', type: 'text', col: true },
    ],
    canCreate: true,
    canEdit: true,
    canDelete: false,
    createText: 'Add school',
  },
  q: {
    mod: 'q',
    title: 'Question Bank',
    base: '/questions',
    filters: [
      { key: 'comp', label: 'Competition', options: [], ref: 'competitions' },
      { key: 'category', label: 'Category', options: ['IQ', 'EQ', 'Values'] },
      { key: 'grade', label: 'Grade', options: ['9', '10', '11', '12'] },
    ],
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'prompt', label: 'Prompt' },
      { key: 'category', label: 'Category', type: 'badge', badgeMap: { IQ: 'blue', EQ: 'purple', Values: 'pink' } },
      { key: 'grade', label: 'Grade' },
      { key: 'qtype', label: 'Type', type: 'badge', badgeMap: { text: 'grey', video: 'purple', image: 'gold' } },
      { key: 'competition', label: 'Competition' },
    ],
    fields: [
      { key: 'competitionCode', label: 'Competition', type: 'select', ref: 'competitions' },
      { key: 'grade', label: 'Grade', type: 'text', required: true },
      { key: 'category', label: 'Category', type: 'select', required: true, options: ['IQ', 'EQ', 'Values'] },
      { key: 'qtype', label: 'Type', type: 'select', options: ['text', 'video', 'image'] },
      { key: 'mode', label: 'Answer mode', type: 'select', options: ['single', 'multi'] },
      { key: 'media', label: 'Media URL', type: 'text', col: true },
      { key: 'label', label: 'Label', type: 'text', col: true },
      { key: 'timeLimitSecs', label: 'Time limit (secs)', type: 'number', col: true },
      { key: 'prompt', label: 'Prompt', type: 'textarea', required: true, rows: 2 },
      { key: 'options', label: 'Options (one per line)', type: 'lines', help: 'Each line becomes an option' },
      { key: 'correct', label: 'Correct index (0-based, comma separated)', type: 'indices', help: 'e.g. 0 or 1,2' },
    ],
    canCreate: true,
    canEdit: true,
    canDelete: true,
    createText: 'Add question',
    createTransform: (f) => {
      const o = (f['options'] as string[]) ?? [];
      const c = (f['correct'] as number[]) ?? [];
      return { ...f, options: o, correct: c };
    },
  },
  ex: {
    mod: 'ex',
    title: 'Exam Dates',
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
      { key: 'time', label: 'Time' },
      { key: 'durationMin', label: 'Min' },
      { key: 'status', label: 'Status', type: 'badge', badgeMap: { Draft: 'grey', Scheduled: 'blue', Live: 'green', Closed: 'red' } },
    ],
    fields: [
      { key: 'competitionCode', label: 'Competition', type: 'select', ref: 'competitions' },
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'grade', label: 'Grade band', type: 'text', col: true },
      { key: 'date', label: 'Date', type: 'date', col: true },
      { key: 'time', label: 'Start time', type: 'text', col: true, placeholder: '10:00' },
      { key: 'durationMin', label: 'Duration (min)', type: 'number', col: true },
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
  ann: {
    mod: 'ann',
    title: 'Announcements',
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
      { key: 'photo', label: 'Photo URL', type: 'text' },
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
      { key: 'cover', label: 'Cover URL', type: 'text' },
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
      { key: 'password', label: 'Password (6+ chars)', type: 'password', help: 'Required on create; leave blank to keep on edit', editOnly: true },
      { key: 'role', label: 'Role', type: 'select', options: ['Super Admin', 'Editor', 'Viewer'] },
      { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Disabled'] },
      { key: 'modules', label: 'Module access', type: 'lines', help: 'Codes: dash comp prize lb res reg pay sch q ex gri nt ann news gal spon plan ad' },
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
