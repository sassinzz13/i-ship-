import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE } from '../../../core/config/api.config';
import { ApiSuccess, ListParams, Page } from '../../../shared/models/api.model';
import { toParams, unwrap, unwrapPage } from '../../../shared/utilities/http';
import { Assignment, CreateAssignmentInput } from '../models/assignment.model';

@Injectable({ providedIn: 'root' })
export class AssignmentService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_BASE}/assignments`;

  list(params: ListParams = {}): Observable<Page<Assignment>> {
    return this.http.get<ApiSuccess<Assignment[]>>(this.url, { params: toParams(params) }).pipe(unwrapPage());
  }

  get(id: number): Observable<Assignment> {
    return this.http.get<ApiSuccess<Assignment>>(`${this.url}/${id}`).pipe(unwrap());
  }

  create(input: CreateAssignmentInput): Observable<Assignment> {
    return this.http.post<ApiSuccess<Assignment>>(this.url, input).pipe(unwrap());
  }

  cancel(id: number, reason?: string | null): Observable<Assignment> {
    return this.http.post<ApiSuccess<Assignment>>(`${this.url}/${id}/cancel`, { reason }).pipe(unwrap());
  }

  /** Driver: own assignments. */
  mine(scope: 'active' | 'history' = 'active'): Observable<Assignment[]> {
    return this.http.get<ApiSuccess<Assignment[]>>(`${this.url}/mine`, { params: { scope } }).pipe(unwrap());
  }

  accept(id: number): Observable<Assignment> {
    return this.http.post<ApiSuccess<Assignment>>(`${this.url}/${id}/accept`, {}).pipe(unwrap());
  }

  reject(id: number, reason: string): Observable<Assignment> {
    return this.http.post<ApiSuccess<Assignment>>(`${this.url}/${id}/reject`, { reason }).pipe(unwrap());
  }

  start(id: number): Observable<Assignment> {
    return this.http.post<ApiSuccess<Assignment>>(`${this.url}/${id}/start`, {}).pipe(unwrap());
  }
}
