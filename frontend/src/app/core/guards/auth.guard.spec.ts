import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';

import { Role } from '../auth/auth.models';
import { AuthService } from '../auth/auth.service';
import { authGuard, guestGuard, roleGuard } from './auth.guard';

class FakeAuth {
  current: Role | null = null;
  isAuthenticated = () => this.current !== null;
  hasRole = (...roles: Role[]) => this.current !== null && roles.includes(this.current);
  homeUrl = () => (this.current === 'DRIVER' ? '/driver' : '/dashboard');
}

describe('auth guards', () => {
  let auth: FakeAuth;
  const state = { url: '/shipments/5' } as RouterStateSnapshot;
  const route = (roles?: Role[]) => ({ data: roles ? { roles } : {} }) as unknown as ActivatedRouteSnapshot;
  const run = (fn: () => unknown) => TestBed.runInInjectionContext(fn);

  beforeEach(() => {
    auth = new FakeAuth();
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AuthService, useValue: auth }] });
  });

  it('authGuard redirects anonymous users to login with returnUrl', () => {
    const result = run(() => authGuard(route(), state)) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/login?returnUrl=%2Fshipments%2F5');
  });

  it('authGuard allows signed-in users', () => {
    auth.current = 'STAFF';
    expect(run(() => authGuard(route(), state))).toBe(true);
  });

  it('roleGuard blocks roles not listed and sends them home', () => {
    auth.current = 'DRIVER';
    const result = run(() => roleGuard(route(['ADMIN', 'DISPATCHER']), state)) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/driver');
  });

  it('roleGuard allows listed roles and routes without restrictions', () => {
    auth.current = 'DISPATCHER';
    expect(run(() => roleGuard(route(['ADMIN', 'DISPATCHER']), state))).toBe(true);
    expect(run(() => roleGuard(route(), state))).toBe(true);
  });

  it('guestGuard redirects signed-in users to their home', () => {
    auth.current = 'ADMIN';
    const result = run(() => guestGuard(route(), state)) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/dashboard');
  });
});
