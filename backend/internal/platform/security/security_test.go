package security_test

import (
	"strings"
	"testing"
	"time"

	"github.com/sassinzz13/i-ship/backend/internal/platform/security"
)

const secret = "test-secret-test-secret-test-secret-0123456789"

func TestPasswordHashing(t *testing.T) {
	hash, err := security.HashPassword("correct horse battery")
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(hash, "correct horse") || !strings.HasPrefix(hash, "$2") {
		t.Fatalf("hash does not look like bcrypt: %q", hash)
	}
	if !security.CheckPassword(hash, "correct horse battery") {
		t.Error("valid password rejected")
	}
	if security.CheckPassword(hash, "wrong") {
		t.Error("invalid password accepted")
	}
	if _, err := security.HashPassword(strings.Repeat("a", 73)); err == nil {
		t.Error("expected error for >72 byte password")
	}
}

func TestTokenRoundTrip(t *testing.T) {
	tm := security.NewTokenManager(secret, 15*time.Minute)
	cid := int64(7)
	tok, exp, err := tm.Issue(security.Principal{UserID: 42, Email: "a@b.c", Role: security.RoleCustomer, CustomerID: &cid})
	if err != nil {
		t.Fatal(err)
	}
	if time.Until(exp) < 14*time.Minute {
		t.Errorf("unexpected expiry %v", exp)
	}
	p, err := tm.Verify(tok)
	if err != nil {
		t.Fatal(err)
	}
	if p.UserID != 42 || p.Role != security.RoleCustomer || p.CustomerID == nil || *p.CustomerID != 7 {
		t.Errorf("unexpected principal %+v", p)
	}
}

func TestTokenExpiry(t *testing.T) {
	past := time.Now().Add(-time.Hour)
	tok, _, _ := security.NewTokenManager(secret, 15*time.Minute).WithClock(func() time.Time { return past }).Issue(
		security.Principal{UserID: 1, Role: security.RoleAdmin})
	if _, err := security.NewTokenManager(secret, 15*time.Minute).Verify(tok); err == nil {
		t.Fatal("expired token accepted")
	}
}

func TestTokenRejectsWrongSecretAndTampering(t *testing.T) {
	tok, _, _ := security.NewTokenManager(secret, time.Minute).Issue(security.Principal{UserID: 1, Role: security.RoleStaff})
	if _, err := security.NewTokenManager(secret+"x", time.Minute).Verify(tok); err == nil {
		t.Error("token signed with another secret accepted")
	}
	parts := strings.Split(tok, ".")
	// Swap in a payload claiming ADMIN; the signature no longer matches.
	forged := parts[0] + ".eyJyb2xlIjoiQURNSU4iLCJzdWIiOiIxIiwiaXNzIjoiaS1zaGlwIiwiZXhwIjo5OTk5OTk5OTk5fQ." + parts[2]
	if _, err := security.NewTokenManager(secret, time.Minute).Verify(forged); err == nil {
		t.Error("tampered token accepted")
	}
	if _, err := security.NewTokenManager(secret, time.Minute).Verify("eyJhbGciOiJub25lIn0.eyJzdWIiOiIxIn0."); err == nil {
		t.Error("alg=none token accepted")
	}
}
