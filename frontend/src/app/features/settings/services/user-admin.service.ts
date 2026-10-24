import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Role } from '../../../core/auth/auth.models';
import { API_BASE } from '../../../core/config/api.config';
import { ApiSuccess, ListParams, Page } from '../../../shared/models/api.model';
import { toParams, unwrap, unwrapPage } from '../../../shared/utilities/http';
import { UserRecord } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UserAdminService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_BASE}/users`;

  list(params: ListParams = {}): Observable<Page<UserRecord>> {
    return this.http.get<ApiSuccess<UserRecord[]>>(this.url, { params: toParams(params) }).pipe(unwrapPage());
  }

  create(input: { email: string; password: string; fullName: string; phone?: string | null; role: Role }): Observable<UserRecord> {
    return this.http.post<ApiSuccess<UserRecord>>(this.url, input).pipe(unwrap());
  }

  update(id: number, input: { fullName: string; phone?: string | null; role: Role; isActive: boolean }): Observable<UserRecord> {
    return this.http.put<ApiSuccess<UserRecord>>(`${this.url}/${id}`, input).pipe(unwrap());
  }

  resetPassword(id: number, password: string): Observable<unknown> {
    return this.http.put<ApiSuccess<unknown>>(`${this.url}/${id}/password`, { password }).pipe(unwrap());
  }
}
