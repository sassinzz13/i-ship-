import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE } from '../../../core/config/api.config';
import { ApiSuccess, ListParams, Page } from '../../../shared/models/api.model';
import { toParams, unwrap, unwrapPage } from '../../../shared/utilities/http';
import { Vehicle, VehicleInput } from '../models/vehicle.model';

@Injectable({ providedIn: 'root' })
export class VehicleService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_BASE}/vehicles`;

  list(params: ListParams = {}): Observable<Page<Vehicle>> {
    return this.http.get<ApiSuccess<Vehicle[]>>(this.url, { params: toParams(params) }).pipe(unwrapPage());
  }

  get(id: number): Observable<Vehicle> {
    return this.http.get<ApiSuccess<Vehicle>>(`${this.url}/${id}`).pipe(unwrap());
  }

  create(input: VehicleInput): Observable<Vehicle> {
    return this.http.post<ApiSuccess<Vehicle>>(this.url, input).pipe(unwrap());
  }

  update(id: number, input: VehicleInput): Observable<Vehicle> {
    return this.http.put<ApiSuccess<Vehicle>>(`${this.url}/${id}`, input).pipe(unwrap());
  }
}
