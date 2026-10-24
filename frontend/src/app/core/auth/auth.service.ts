import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, of, shareReplay, tap, throwError } from 'rxjs';

import { ApiSuccess } from '../../shared/models/api.model';
import { API_BASE } from '../config/api.config';
import { CurrentUser, Role, SessionResponse } from './auth.models';

/**
 * Holds the session. The access token lives in memory only; the refresh
 * token is an httpOnly cookie the browser sends to /api/v1/auth, so a page
 * reload restores the session through `restore()`.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly token = signal<string | null>(null);
  private readonly currentUser = signal<CurrentUser | null>(null);
  private refreshInFlight: Observable<string | null> | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  readonly user = this.currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  readonly role = computed(() => this.currentUser()?.role ?? null);

  accessToken(): string | null {
    return this.token();
  }

  hasRole(...roles: Role[]): boolean {
    const r = this.role();
    return r !== null && roles.includes(r);
  }

  /** Landing route for the signed-in user's role. */
  homeUrl(): string {
    switch (this.role()) {
      case 'DRIVER':
        return '/driver';
      case 'CUSTOMER':
        return '/shipments';
      default:
        return '/dashboard';
    }
  }

  login(email: string, password: string): Observable<CurrentUser> {
    return this.http
      .post<ApiSuccess<SessionResponse>>(`${API_BASE}/auth/login`, { email, password }, { withCredentials: true })
      .pipe(
        map((r) => r.data),
        tap((s) => this.applySession(s)),
        map((s) => s.user),
      );
  }

  /** Restores the session from the refresh cookie (used at startup). */
  restore(): Observable<boolean> {
    return this.refresh().pipe(
      map((t) => t !== null),
      catchError(() => of(false)),
    );
  }

  /**
   * Exchanges the refresh cookie for a new access token. Concurrent callers
   * share one request, so a burst of 401s triggers a single refresh.
   */
  refresh(): Observable<string | null> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.http
        .post<ApiSuccess<SessionResponse>>(`${API_BASE}/auth/refresh`, {}, { withCredentials: true })
        .pipe(
          map((r) => r.data),
          tap((s) => this.applySession(s)),
          map((s) => s.accessToken as string | null),
          catchError((err) => {
            this.clear();
            return throwError(() => err);
          }),
          finalize(() => (this.refreshInFlight = null)),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
    }
    return this.refreshInFlight;
  }

  logout(): void {
    this.http
      .post(`${API_BASE}/auth/logout`, {}, { withCredentials: true })
      .pipe(catchError(() => of(null)))
      .subscribe(() => {
        this.clear();
        void this.router.navigateByUrl('/login');
      });
  }

  /** Clears local state after the server rejected our session. */
  expire(): void {
    this.clear();
    void this.router.navigate(['/login'], { queryParams: { expired: 1 } });
  }

  updateUser(patch: Partial<CurrentUser>): void {
    const u = this.currentUser();
    if (u) this.currentUser.set({ ...u, ...patch });
  }

  private applySession(s: SessionResponse): void {
    this.token.set(s.accessToken);
    this.currentUser.set(s.user);
    this.scheduleRefresh(s.expiresIn);
  }

  /** Refreshes shortly before the access token expires. */
  private scheduleRefresh(expiresInSeconds: number): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    const ms = Math.max((expiresInSeconds - 60) * 1000, 10_000);
    this.refreshTimer = setTimeout(() => this.refresh().subscribe({ error: () => this.expire() }), ms);
  }

  private clear(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = null;
    this.token.set(null);
    this.currentUser.set(null);
  }
}
