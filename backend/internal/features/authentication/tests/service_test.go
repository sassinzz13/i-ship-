package tests

import (
	"context"
	"testing"
	"time"

	"github.com/sassinzz13/i-ship/backend/internal/features/authentication"
	"github.com/sassinzz13/i-ship/backend/internal/platform/security"
	apperr "github.com/sassinzz13/i-ship/backend/internal/shared/errors"
	"github.com/sassinzz13/i-ship/backend/tests/testutil"
)

func setup(t *testing.T, accts ...authentication.Account) (*authentication.Service, *fakeRepo, *testutil.Recorder, *security.TokenManager) {
	t.Helper()
	repo := newFakeRepo(accts...)
	rec := &testutil.Recorder{}
	tm := security.NewTokenManager(testutil.Secret, 15*time.Minute)
	svc := authentication.NewService(authentication.ServiceDeps{
		Repo: repo, Tx: testutil.NoTx{}, Tokens: tm, Audit: rec, RefreshTTL: time.Hour,
	})
	return svc, repo, rec, tm
}

func account(t *testing.T, id int64, email, password string, role security.Role) authentication.Account {
	t.Helper()
	hash, err := security.HashPassword(password)
	if err != nil {
		t.Fatal(err)
	}
	return authentication.Account{ID: id, Email: email, PasswordHash: hash, FullName: "Test", Role: role, IsActive: true}
}

func TestLoginSuccessIssuesVerifiableTokens(t *testing.T) {
	driverID := int64(9)
	a := account(t, 1, "driver@example.com", "s3cret-pass", security.RoleDriver)
	a.DriverID = &driverID
	svc, repo, rec, tm := setup(t, a)

	sess, err := svc.Login(context.Background(), "  Driver@Example.com ", "s3cret-pass")
	if err != nil {
		t.Fatalf("login: %v", err)
	}
	if sess.RefreshToken == "" || sess.AccessToken == "" {
		t.Fatal("expected tokens")
	}
	p, err := tm.Verify(sess.AccessToken)
	if err != nil {
		t.Fatal(err)
	}
	if p.UserID != 1 || p.Role != security.RoleDriver || p.DriverID == nil || *p.DriverID != 9 {
		t.Errorf("principal = %+v", p)
	}
	if repo.activeTokens() != 1 {
		t.Errorf("expected 1 stored refresh token, got %d", repo.activeTokens())
	}
	if !rec.Has("auth.login") {
		t.Error("login not audited")
	}
}

func TestLoginRejectsBadCredentials(t *testing.T) {
	svc, _, rec, _ := setup(t, account(t, 1, "a@example.com", "right-password", security.RoleStaff))
	for _, tc := range []struct{ email, pw string }{
		{"a@example.com", "wrong-password"},
		{"nobody@example.com", "right-password"},
	} {
		_, err := svc.Login(context.Background(), tc.email, tc.pw)
		if !apperr.Is(err, apperr.CodeUnauthorized) {
			t.Errorf("%s: expected UNAUTHORIZED, got %v", tc.email, err)
		}
	}
	if !rec.Has("auth.login_failed") {
		t.Error("failed login not audited")
	}
}

func TestLoginRejectsInactiveAccount(t *testing.T) {
	a := account(t, 1, "a@example.com", "right-password", security.RoleStaff)
	a.IsActive = false
	svc, _, _, _ := setup(t, a)
	if _, err := svc.Login(context.Background(), "a@example.com", "right-password"); !apperr.Is(err, apperr.CodeForbidden) {
		t.Fatalf("expected FORBIDDEN, got %v", err)
	}
}

func TestRefreshRotatesToken(t *testing.T) {
	svc, repo, _, _ := setup(t, account(t, 1, "a@example.com", "right-password", security.RoleAdmin))
	ctx := context.Background()
	s1, _ := svc.Login(ctx, "a@example.com", "right-password")

	s2, err := svc.Refresh(ctx, s1.RefreshToken)
	if err != nil {
		t.Fatalf("refresh: %v", err)
	}
	if s2.RefreshToken == s1.RefreshToken {
		t.Fatal("refresh token was not rotated")
	}
	if repo.activeTokens() != 1 {
		t.Errorf("expected only the new token to be active, got %d", repo.activeTokens())
	}
}

func TestRefreshReuseRevokesFamily(t *testing.T) {
	svc, repo, rec, _ := setup(t, account(t, 1, "a@example.com", "right-password", security.RoleAdmin))
	ctx := context.Background()
	s1, _ := svc.Login(ctx, "a@example.com", "right-password")
	s2, _ := svc.Refresh(ctx, s1.RefreshToken)

	// An attacker replays the old token.
	if _, err := svc.Refresh(ctx, s1.RefreshToken); !apperr.Is(err, apperr.CodeUnauthorized) {
		t.Fatalf("reuse should fail, got %v", err)
	}
	if !rec.Has("auth.refresh_reuse_detected") {
		t.Error("reuse not audited")
	}
	// The legitimate (latest) token is now revoked as well.
	if _, err := svc.Refresh(ctx, s2.RefreshToken); err == nil {
		t.Fatal("token family should be revoked after reuse")
	}
	if repo.activeTokens() != 0 {
		t.Errorf("expected no active tokens, got %d", repo.activeTokens())
	}
}

func TestRefreshRejectsUnknownAndEmpty(t *testing.T) {
	svc, _, _, _ := setup(t)
	for _, raw := range []string{"", "not-a-real-token"} {
		if _, err := svc.Refresh(context.Background(), raw); !apperr.Is(err, apperr.CodeUnauthorized) {
			t.Errorf("%q: expected UNAUTHORIZED, got %v", raw, err)
		}
	}
}

func TestLogoutRevokesSession(t *testing.T) {
	svc, repo, _, _ := setup(t, account(t, 1, "a@example.com", "right-password", security.RoleAdmin))
	ctx := context.Background()
	s1, _ := svc.Login(ctx, "a@example.com", "right-password")
	if err := svc.Logout(ctx, s1.RefreshToken); err != nil {
		t.Fatal(err)
	}
	if repo.activeTokens() != 0 {
		t.Error("logout did not revoke the token")
	}
	if _, err := svc.Refresh(ctx, s1.RefreshToken); err == nil {
		t.Error("refresh after logout should fail")
	}
}

func TestChangePasswordRequiresCurrentAndRevokesSessions(t *testing.T) {
	svc, repo, _, _ := setup(t, account(t, 1, "a@example.com", "old-password", security.RoleStaff))
	ctx := context.Background()
	_, _ = svc.Login(ctx, "a@example.com", "old-password")

	if err := svc.ChangePassword(ctx, 1, "nope", "new-password-1"); !apperr.Is(err, apperr.CodeValidation) {
		t.Fatalf("expected VALIDATION_ERROR, got %v", err)
	}
	if err := svc.ChangePassword(ctx, 1, "old-password", "new-password-1"); err != nil {
		t.Fatal(err)
	}
	if repo.activeTokens() != 0 {
		t.Error("sessions should be revoked after password change")
	}
	if _, err := svc.Login(ctx, "a@example.com", "new-password-1"); err != nil {
		t.Errorf("login with new password: %v", err)
	}
}
