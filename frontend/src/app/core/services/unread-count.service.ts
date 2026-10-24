import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, of } from 'rxjs';

import { ApiSuccess } from '../../shared/models/api.model';
import { API_BASE } from '../config/api.config';

/** Polls the unread-notification count for the shell's bell badge. */
@Injectable({ providedIn: 'root' })
export class UnreadCountService {
  private readonly http = inject(HttpClient);
  private timer: ReturnType<typeof setInterval> | null = null;
  readonly count = signal(0);

  start(): void {
    this.stop();
    this.load();
    this.timer = setInterval(() => this.load(), 60_000);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  load(): void {
    this.http
      .get<ApiSuccess<{ unread: number }>>(`${API_BASE}/notifications/unread-count`)
      .pipe(catchError(() => of(null)))
      .subscribe((r) => r && this.count.set(r.data.unread));
  }
}
