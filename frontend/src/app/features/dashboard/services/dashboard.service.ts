import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE } from '../../../core/config/api.config';
import { ApiSuccess } from '../../../shared/models/api.model';
import { unwrap } from '../../../shared/utilities/http';
import { DashboardSummary } from '../models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);

  summary(): Observable<DashboardSummary> {
    return this.http.get<ApiSuccess<DashboardSummary>>(`${API_BASE}/dashboard/summary`).pipe(unwrap());
  }
}
