import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE } from '../../../core/config/api.config';
import { ApiSuccess, ListParams, Page } from '../../../shared/models/api.model';
import { toParams, unwrap, unwrapPage } from '../../../shared/utilities/http';
import { DeliveryAttempt, DeliveryRecord, FailedAttemptInput, ProofInput } from '../models/delivery.model';

@Injectable({ providedIn: 'root' })
export class DeliveryService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_BASE}/deliveries`;

  list(params: ListParams = {}): Observable<Page<DeliveryAttempt>> {
    return this.http.get<ApiSuccess<DeliveryAttempt[]>>(this.url, { params: toParams(params) }).pipe(unwrapPage());
  }

  forShipment(shipmentId: number): Observable<DeliveryRecord> {
    return this.http.get<ApiSuccess<DeliveryRecord>>(`${this.url}/${shipmentId}`).pipe(unwrap());
  }

  recordFailedAttempt(shipmentId: number, input: FailedAttemptInput): Observable<DeliveryAttempt> {
    return this.http.post<ApiSuccess<DeliveryAttempt>>(`${this.url}/${shipmentId}/attempts`, input).pipe(unwrap());
  }

  submitProof(shipmentId: number, input: ProofInput): Observable<DeliveryRecord> {
    const form = new FormData();
    form.set('recipientName', input.recipientName);
    form.set('recipientRelationship', input.recipientRelationship);
    if (input.notes) form.set('notes', input.notes);
    if (input.latitude != null) form.set('latitude', String(input.latitude));
    if (input.longitude != null) form.set('longitude', String(input.longitude));
    if (input.signature) form.set('signature', input.signature, 'signature.png');
    if (input.photo) form.set('photo', input.photo, 'photo.jpg');
    return this.http.post<ApiSuccess<DeliveryRecord>>(`${this.url}/${shipmentId}/proof`, form).pipe(unwrap());
  }

  /** Proof images require the bearer token, so fetch them as blobs and
   *  render via object URLs. */
  proofImage(shipmentId: number, kind: 'signature' | 'photo'): Observable<Blob> {
    return this.http.get(`${this.url}/${shipmentId}/proof/${kind}`, { responseType: 'blob' });
  }
}
