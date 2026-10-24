import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE } from '../../../core/config/api.config';
import { ApiSuccess, ListParams, Page } from '../../../shared/models/api.model';
import { toParams, unwrapPage } from '../../../shared/utilities/http';
import { AuditLog } from '../models/audit-log.model';

@Injectable({ providedIn: 'root' })
export class AuditLogService {
  private readonly http = inject(HttpClient);

  list(params: ListParams = {}): Observable<Page<AuditLog>> {
    return this.http.get<ApiSuccess<AuditLog[]>>(`${API_BASE}/audit-logs`, { params: toParams(params) }).pipe(unwrapPage());
  }
}
