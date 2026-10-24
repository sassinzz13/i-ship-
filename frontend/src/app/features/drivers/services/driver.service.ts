import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE } from '../../../core/config/api.config';
import { ApiSuccess, ListParams, Page } from '../../../shared/models/api.model';
import { toParams, unwrap, unwrapPage } from '../../../shared/utilities/http';
import { CreateDriverInput, Driver, DriverAvailability, UpdateDriverInput } from '../models/driver.model';

@Injectable({ providedIn: 'root' })
export class DriverService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_BASE}/drivers`;

  list(params: ListParams = {}): Observable<Page<Driver>> {
    return this.http.get<ApiSuccess<Driver[]>>(this.url, { params: toParams(params) }).pipe(unwrapPage());
  }

  get(id: number): Observable<Driver> {
    return this.http.get<ApiSuccess<Driver>>(`${this.url}/${id}`).pipe(unwrap());
  }

  create(input: CreateDriverInput): Observable<Driver> {
    return this.http.post<ApiSuccess<Driver>>(this.url, input).pipe(unwrap());
  }

  update(id: number, input: UpdateDriverInput): Observable<Driver> {
    return this.http.put<ApiSuccess<Driver>>(`${this.url}/${id}`, input).pipe(unwrap());
  }

  me(): Observable<Driver> {
    return this.http.get<ApiSuccess<Driver>>(`${this.url}/me`).pipe(unwrap());
  }

  setMyAvailability(availability: Extract<DriverAvailability, 'AVAILABLE' | 'OFF_DUTY'>): Observable<Driver> {
    return this.http.put<ApiSuccess<Driver>>(`${this.url}/me/availability`, { availability }).pipe(unwrap());
  }
}
