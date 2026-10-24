import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE } from '../../../core/config/api.config';
import { ApiSuccess, ListParams, Page } from '../../../shared/models/api.model';
import { toParams, unwrap, unwrapPage } from '../../../shared/utilities/http';
import { AppNotification } from '../models/notification.model';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_BASE}/notifications`;

  list(params: ListParams = {}): Observable<Page<AppNotification>> {
    return this.http.get<ApiSuccess<AppNotification[]>>(this.url, { params: toParams(params) }).pipe(unwrapPage());
  }

  markRead(id: number): Observable<unknown> {
    return this.http.post<ApiSuccess<unknown>>(`${this.url}/${id}/read`, {}).pipe(unwrap());
  }

  markAllRead(): Observable<unknown> {
    return this.http.post<ApiSuccess<unknown>>(`${this.url}/read-all`, {}).pipe(unwrap());
  }
}
