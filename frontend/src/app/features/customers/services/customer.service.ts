import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE } from '../../../core/config/api.config';
import { ApiSuccess, ListParams, Page } from '../../../shared/models/api.model';
import { toParams, unwrap, unwrapPage } from '../../../shared/utilities/http';
import { Customer, CustomerInput } from '../models/customer.model';

@Injectable({ providedIn: 'root' })
export class CustomerService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_BASE}/customers`;

  list(params: ListParams = {}): Observable<Page<Customer>> {
    return this.http.get<ApiSuccess<Customer[]>>(this.url, { params: toParams(params) }).pipe(unwrapPage());
  }

  get(id: number): Observable<Customer> {
    return this.http.get<ApiSuccess<Customer>>(`${this.url}/${id}`).pipe(unwrap());
  }

  create(input: CustomerInput): Observable<Customer> {
    return this.http.post<ApiSuccess<Customer>>(this.url, input).pipe(unwrap());
  }

  update(id: number, input: CustomerInput): Observable<Customer> {
    return this.http.put<ApiSuccess<Customer>>(`${this.url}/${id}`, input).pipe(unwrap());
  }

  me(): Observable<Customer> {
    return this.http.get<ApiSuccess<Customer>>(`${this.url}/me`).pipe(unwrap());
  }

  updateMe(input: { fullName: string; companyName?: string | null; phone: string }): Observable<Customer> {
    return this.http.put<ApiSuccess<Customer>>(`${this.url}/me`, input).pipe(unwrap());
  }
}
