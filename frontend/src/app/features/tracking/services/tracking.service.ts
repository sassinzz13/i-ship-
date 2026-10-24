import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE } from '../../../core/config/api.config';
import { ApiSuccess } from '../../../shared/models/api.model';
import { unwrap } from '../../../shared/utilities/http';
import { PublicTracking } from '../models/tracking.model';

@Injectable({ providedIn: 'root' })
export class TrackingService {
  private readonly http = inject(HttpClient);

  track(trackingNumber: string): Observable<PublicTracking> {
    return this.http
      .get<ApiSuccess<PublicTracking>>(`${API_BASE}/tracking/${encodeURIComponent(trackingNumber.trim().toUpperCase())}`)
      .pipe(unwrap());
  }
}
