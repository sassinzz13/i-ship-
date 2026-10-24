import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE } from '../../../core/config/api.config';
import { ApiSuccess, ListParams, Page } from '../../../shared/models/api.model';
import { toParams, unwrap, unwrapPage } from '../../../shared/utilities/http';
import { Payment, PaymentInput, PaymentRecordStatus } from '../models/payment.model';

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_BASE}/payments`;

  list(params: ListParams = {}): Observable<Page<Payment>> {
    return this.http.get<ApiSuccess<Payment[]>>(this.url, { params: toParams(params) }).pipe(unwrapPage());
  }

  create(input: PaymentInput): Observable<Payment> {
    return this.http.post<ApiSuccess<Payment>>(this.url, input).pipe(unwrap());
  }

  updateStatus(id: number, status: Exclude<PaymentRecordStatus, 'PENDING'>, reference?: string | null): Observable<Payment> {
    return this.http.put<ApiSuccess<Payment>>(`${this.url}/${id}/status`, { status, reference }).pipe(unwrap());
  }
}
