import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE } from '../../../core/config/api.config';
import { ApiSuccess } from '../../../shared/models/api.model';
import { unwrap } from '../../../shared/utilities/http';

@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly http = inject(HttpClient);

  changePassword(currentPassword: string, newPassword: string): Observable<{ passwordChanged: boolean }> {
    return this.http
      .put<ApiSuccess<{ passwordChanged: boolean }>>(`${API_BASE}/auth/password`, { currentPassword, newPassword })
      .pipe(unwrap());
  }
}
