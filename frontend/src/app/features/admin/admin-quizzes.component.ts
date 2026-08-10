import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-admin-quizzes',
  imports: [FormsModule],
  template: `
    <div class="section-title"><h1>Quizzes & Questions</h1></div>
    @if (msg()) { <div class="alert ok">{{ msg() }}</div> }
    @if (error()) { <div class="alert error">{{ error() }}</div> }

    <div class="grid cols-2">
      <!-- Create quiz -->
      <div class="card">
        <h3>Create quiz</h3>
        <label>Title</label><input [(ngModel)]="q.title" />
        <div class="grid cols-2">
          <div>
            <label>Type</label>
            <select [(ngModel)]="q.quizType">
              <option value="Practice">Practice</option>
              <option value="Mock">Mock</option>
              <option value="Qualifier">Qualifier</option>
            </select>
          </div>
          <div><label>Duration (sec)</label><input type="number" [(ngModel)]="q.durationSeconds" /></div>
          <div><label>Total Questions</label><input type="number" [(ngModel)]="q.totalQuestions" /></div>
          <div><label>Mark / correct</label><input type="number" [(ngModel)]="q.markPerCorrect" /></div>
          <div><label>Mark / wrong (neg)</label><input type="number" [(ngModel)]="q.markPerWrong" /></div>
        </div>
        <button class="btn btn-primary btn-block" style="margin-top:1rem;" (click)="createQuiz()">Create quiz</button>
      </div>

      <!-- Create question -->
      <div class="card">
        <h3>Create question</h3>
        <div class="grid cols-2">
          <div>
            <label>Category</label>
            <select [(ngModel)]="ques.categoryCode">
              <option value="IQ">IQ</option>
              <option value="EQ">EQ</option>
              <option value="VAL">Values</option>
            </select>
          </div>
          <div>
            <label>Difficulty</label>
            <select [(ngModel)]="ques.difficulty">
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>
        </div>
        <label>Question text</label>
        <textarea rows="2" [(ngModel)]="ques.text"></textarea>
        @for (o of optionTexts; track $index) {
          <div class="row" style="flex-wrap:nowrap; align-items:center; margin-top:.4rem;">
            <input type="radio" name="correct" style="width:auto;" [value]="$index" [(ngModel)]="correctIndex" />
            <input [(ngModel)]="optionTexts[$index]" placeholder="Option {{ $index + 1 }}" />
          </div>
        }
        <button class="btn btn-primary btn-block" style="margin-top:1rem;" (click)="createQuestion()">Add question</button>
      </div>
    </div>

    <!-- Quizzes list -->
    <div class="card" style="margin-top:1rem;">
      <h3>Quizzes</h3>
      @if (quizzes().length) {
        <table class="table">
          <thead><tr><th>ID</th><th>Title</th><th>Type</th><th>Q's</th><th>Pool</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            @for (z of quizzes(); track z.QuizId) {
              <tr>
                <td>{{ z.QuizId }}</td>
                <td>{{ z.Title }}</td>
                <td><span class="badge violet">{{ z.QuizType }}</span></td>
                <td>{{ z.TotalQuestions }}</td>
                <td>{{ z.PoolSize }}</td>
                <td>
                  @if (z.Status === 'Published') { <span class="badge green">Published</span> }
                  @else { <span class="badge amber">{{ z.Status }}</span> }
                </td>
                <td>
                  <button class="btn btn-sm" (click)="attach(z.QuizId)" [disabled]="!selected().size">Attach {{ selected().size }} Q</button>
                  <button class="btn btn-sm btn-primary" (click)="publish(z.QuizId)">Publish</button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      } @else { <div class="loading">No quizzes yet.</div> }
    </div>

    <!-- Questions list -->
    <div class="card" style="margin-top:1rem;">
      <h3>Question bank <span class="muted">(select to attach)</span></h3>
      @if (questions().length) {
        <table class="table">
          <thead><tr><th></th><th>ID</th><th>Category</th><th>Question</th><th>Options</th></tr></thead>
          <tbody>
            @for (qn of questions(); track qn.QuestionId) {
              <tr>
                <td><input type="checkbox" style="width:auto;" [checked]="selected().has(qn.QuestionId)" (change)="toggle(qn.QuestionId)" /></td>
                <td>{{ qn.QuestionId }}</td>
                <td><span class="badge violet">{{ qn.Category }}</span></td>
                <td>{{ qn.QuestionText }}</td>
                <td>{{ qn.Options }}</td>
              </tr>
            }
          </tbody>
        </table>
      } @else { <div class="loading">No questions yet.</div> }
    </div>
  `,
})
export class AdminQuizzesComponent implements OnInit {
  private api = inject(ApiService);
  quizzes = signal<any[]>([]);
  questions = signal<any[]>([]);
  selected = signal<Set<number>>(new Set());
  msg = signal<string | null>(null);
  error = signal<string | null>(null);

  q = { title: '', quizType: 'Qualifier', durationSeconds: 600, totalQuestions: 5, markPerCorrect: 1, markPerWrong: 0 };
  ques = { categoryCode: 'IQ', difficulty: 'Medium', text: '' };
  optionTexts = ['', '', '', ''];
  correctIndex = 0;

  ngOnInit() { this.loadAll(); }

  loadAll() {
    this.api.get<any[]>('/quizzes').subscribe((r) => this.quizzes.set(r));
    this.api.get<any[]>('/questions').subscribe((r) => this.questions.set(r));
  }

  createQuiz() {
    this.error.set(null);
    this.api.post('/quizzes', this.q).subscribe({
      next: () => { this.msg.set('Quiz created'); this.loadAll(); },
      error: (e) => this.error.set(e?.error?.message ?? 'Failed'),
    });
  }

  createQuestion() {
    this.error.set(null);
    const options = this.optionTexts
      .map((t, i) => ({ text: t, isCorrect: i === this.correctIndex }))
      .filter((o) => o.text.trim());
    this.api.post('/questions', { ...this.ques, questionText: this.ques.text, options }).subscribe({
      next: () => {
        this.msg.set('Question added');
        this.ques.text = '';
        this.optionTexts = ['', '', '', ''];
        this.loadAll();
      },
      error: (e) => this.error.set(e?.error?.message ?? 'Failed'),
    });
  }

  toggle(id: number) {
    const s = new Set(this.selected());
    s.has(id) ? s.delete(id) : s.add(id);
    this.selected.set(s);
  }

  attach(quizId: number) {
    this.api.post(`/quizzes/${quizId}/questions`, { questionIds: [...this.selected()] }).subscribe({
      next: () => { this.msg.set('Questions attached'); this.selected.set(new Set()); this.loadAll(); },
      error: (e) => this.error.set(e?.error?.message ?? 'Failed'),
    });
  }

  publish(quizId: number) {
    this.error.set(null);
    this.api.post(`/quizzes/${quizId}/publish`).subscribe({
      next: () => { this.msg.set('Quiz published'); this.loadAll(); },
      error: (e) => this.error.set(e?.error?.message ?? 'Publish failed'),
    });
  }
}
