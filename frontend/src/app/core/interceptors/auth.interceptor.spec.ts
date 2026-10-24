import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService } from '../auth/auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let ctrl: HttpTestingController;
  let auth: AuthService;

  const session = (token: string) => ({
    success: true,
    data: {
      accessToken: token, tokenType: 'Bearer', expiresAt: '', expiresIn: 900,
      user: { id: 1, email: 'a@b.c', fullName: 'A', phone: null, role: 'ADMIN', customerId: null, driverId: null, lastLoginAt: null },
    },
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'login', children: [] }]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    auth.login('a@b.c', 'pw').subscribe();
    ctrl.expectOne('/api/v1/auth/login').flush(session('token-1'));
  });

  afterEach(() => ctrl.verify());

  it('attaches the bearer token to API requests only', () => {
    http.get('/api/v1/shipments').subscribe();
    http.get('/assets/x.json').subscribe();
    expect(ctrl.expectOne('/api/v1/shipments').request.headers.get('Authorization')).toBe('Bearer token-1');
    expect(ctrl.expectOne('/assets/x.json').request.headers.has('Authorization')).toBe(false);
  });

  it('refreshes once for concurrent 401s and retries each request', () => {
    const results: unknown[] = [];
    http.get('/api/v1/a').subscribe((r) => results.push(r));
    http.get('/api/v1/b').subscribe((r) => results.push(r));
    ctrl.expectOne('/api/v1/a').flush({}, { status: 401, statusText: 'Unauthorized' });
    ctrl.expectOne('/api/v1/b').flush({}, { status: 401, statusText: 'Unauthorized' });

    const refresh = ctrl.match('/api/v1/auth/refresh');
    expect(refresh.length).toBe(1);
    refresh[0].flush(session('token-2'));

    const retryA = ctrl.expectOne('/api/v1/a');
    const retryB = ctrl.expectOne('/api/v1/b');
    expect(retryA.request.headers.get('Authorization')).toBe('Bearer token-2');
    retryA.flush({ ok: 'a' });
    retryB.flush({ ok: 'b' });
    expect(results).toEqual([{ ok: 'a' }, { ok: 'b' }]);
  });

  it('expires the session when refresh fails', () => {
    let failed = false;
    http.get('/api/v1/a').subscribe({ error: () => (failed = true) });
    ctrl.expectOne('/api/v1/a').flush({}, { status: 401, statusText: 'Unauthorized' });
    ctrl.expectOne('/api/v1/auth/refresh').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(failed).toBe(true);
    expect(auth.isAuthenticated()).toBe(false);
  });
});
