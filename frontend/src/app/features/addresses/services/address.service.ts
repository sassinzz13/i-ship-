import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE } from '../../../core/config/api.config';
import { ApiSuccess } from '../../../shared/models/api.model';
import { unwrap } from '../../../shared/utilities/http';
import { Address, AddressInput } from '../models/address.model';

@Injectable({ providedIn: 'root' })
export class AddressService {
  private readonly http = inject(HttpClient);

  listForCustomer(customerId: number, includeArchived = false): Observable<Address[]> {
    return this.http
      .get<ApiSuccess<Address[]>>(`${API_BASE}/customers/${customerId}/addresses`, {
        params: includeArchived ? { includeArchived: 'true' } : {},
      })
      .pipe(unwrap());
  }

  listMine(): Observable<Address[]> {
    return this.http.get<ApiSuccess<Address[]>>(`${API_BASE}/customers/me/addresses`).pipe(unwrap());
  }

  create(customerId: number, input: AddressInput): Observable<Address> {
    return this.http.post<ApiSuccess<Address>>(`${API_BASE}/customers/${customerId}/addresses`, input).pipe(unwrap());
  }

  update(id: number, input: AddressInput): Observable<Address> {
    return this.http.put<ApiSuccess<Address>>(`${API_BASE}/addresses/${id}`, input).pipe(unwrap());
  }

  archive(id: number): Observable<{ archived: boolean }> {
    return this.http.delete<ApiSuccess<{ archived: boolean }>>(`${API_BASE}/addresses/${id}`).pipe(unwrap());
  }
}
