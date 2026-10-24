import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE } from '../../../core/config/api.config';
import { ApiSuccess, ListParams, Page } from '../../../shared/models/api.model';
import { toParams, unwrap, unwrapPage } from '../../../shared/utilities/http';
import { Quote, ServiceType, Shipment, ShipmentInput, ShipmentStatus, ShipmentSummary, StatusHistory } from '../models/shipment.model';

@Injectable({ providedIn: 'root' })
export class ShipmentService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_BASE}/shipments`;

  list(params: ListParams = {}): Observable<Page<ShipmentSummary>> {
    return this.http.get<ApiSuccess<ShipmentSummary[]>>(this.url, { params: toParams(params) }).pipe(unwrapPage());
  }

  get(id: number): Observable<Shipment> {
    return this.http.get<ApiSuccess<Shipment>>(`${this.url}/${id}`).pipe(unwrap());
  }

  create(input: ShipmentInput): Observable<Shipment> {
    return this.http.post<ApiSuccess<Shipment>>(this.url, input).pipe(unwrap());
  }

  update(id: number, input: ShipmentInput): Observable<Shipment> {
    return this.http.put<ApiSuccess<Shipment>>(`${this.url}/${id}`, input).pipe(unwrap());
  }

  history(id: number): Observable<StatusHistory[]> {
    return this.http.get<ApiSuccess<StatusHistory[]>>(`${this.url}/${id}/history`).pipe(unwrap());
  }

  changeStatus(id: number, status: ShipmentStatus, notes?: string | null, location?: string | null): Observable<Shipment> {
    return this.http.post<ApiSuccess<Shipment>>(`${this.url}/${id}/status`, { status, notes, location }).pipe(unwrap());
  }

  quote(serviceType: ServiceType, weight: number): Observable<Quote> {
    return this.http.get<ApiSuccess<Quote>>(`${this.url}/quote`, { params: toParams({ serviceType, weight }) }).pipe(unwrap());
  }
}
