import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1';

  get<T>(path: string, params?: Record<string, unknown>): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}${path}`, { params: params as never });
  }

  post<T>(path: string, body?: unknown): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}${path}`, body ?? {});
  }

  put<T>(path: string, body?: unknown): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}${path}`, body ?? {});
  }

  patch<T>(path: string, body?: unknown): Observable<T> {
    return this.http.patch<T>(`${this.baseUrl}${path}`, body ?? {});
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}${path}`);
  }

  postFile<T>(path: string, file: File): Observable<T> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<T>(`${this.baseUrl}${path}`, form);
  }

  /** A POST whose answer is a file (the parent report link). */
  postBlob(path: string, body?: unknown): Observable<Blob> {
    return this.http.post(`${this.baseUrl}${path}`, body ?? {}, { responseType: 'blob' });
  }

  downloadBlob(path: string, params?: Record<string, unknown>): Observable<Blob> {
    return this.http.get(`${this.baseUrl}${path}`, { params: params as never, responseType: 'blob' });
  }
}
