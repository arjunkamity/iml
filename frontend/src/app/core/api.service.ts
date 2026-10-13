import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_URL } from './config';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  get<T>(path: string) {
    return this.http.get<T>(`${API_URL}${path}`);
  }
  post<T>(path: string, body?: unknown) {
    return this.http.post<T>(`${API_URL}${path}`, body ?? {});
  }

  getBlob(path: string) {
    return this.http.get(`${API_URL}${path}`, { responseType: 'blob' });
  }
}
