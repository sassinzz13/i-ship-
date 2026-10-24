package tests

import (
	"bytes"
	"context"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/sassinzz13/i-ship/backend/internal/features/authentication"
	"github.com/sassinzz13/i-ship/backend/internal/platform/database"
)

type storedToken struct {
	authentication.RefreshToken
	hash []byte
}

// fakeRepo is an in-memory authentication.Repository.
type fakeRepo struct {
	mu       sync.Mutex
	accounts map[int64]*authentication.Account
	tokens   []*storedToken
}

func newFakeRepo(accts ...authentication.Account) *fakeRepo {
	r := &fakeRepo{accounts: map[int64]*authentication.Account{}}
	for i := range accts {
		a := accts[i]
		r.accounts[a.ID] = &a
	}
	return r
}

func (r *fakeRepo) FindAccountByEmail(_ context.Context, _ database.DBTX, email string) (*authentication.Account, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, a := range r.accounts {
		if a.Email == email {
			cp := *a
			return &cp, nil
		}
	}
	return nil, nil
}

func (r *fakeRepo) FindAccountByID(_ context.Context, _ database.DBTX, id int64) (*authentication.Account, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if a, ok := r.accounts[id]; ok {
		cp := *a
		return &cp, nil
	}
	return nil, nil
}

func (r *fakeRepo) UpdatePassword(_ context.Context, _ database.DBTX, id int64, hash string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.accounts[id].PasswordHash = hash
	return nil
}

func (r *fakeRepo) TouchLastLogin(context.Context, database.DBTX, int64) error { return nil }

func (r *fakeRepo) InsertRefreshToken(_ context.Context, _ database.DBTX, userID int64, hash []byte, family uuid.UUID, expires time.Time, _, _ string) (int64, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	id := int64(len(r.tokens) + 1)
	r.tokens = append(r.tokens, &storedToken{
		RefreshToken: authentication.RefreshToken{ID: id, UserID: userID, FamilyID: family, ExpiresAt: expires},
		hash:         hash,
	})
	return id, nil
}

func (r *fakeRepo) LockRefreshToken(_ context.Context, _ database.DBTX, hash []byte) (*authentication.RefreshToken, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, t := range r.tokens {
		if bytes.Equal(t.hash, hash) {
			cp := t.RefreshToken
			return &cp, nil
		}
	}
	return nil, nil
}

func (r *fakeRepo) RevokeRefreshToken(_ context.Context, _ database.DBTX, id int64, _ *int64) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	now := time.Now()
	r.tokens[id-1].RevokedAt = &now
	return nil
}

func (r *fakeRepo) RevokeFamily(_ context.Context, _ database.DBTX, family uuid.UUID) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	now := time.Now()
	for _, t := range r.tokens {
		if t.FamilyID == family && t.RevokedAt == nil {
			t.RevokedAt = &now
		}
	}
	return nil
}

func (r *fakeRepo) RevokeAllForUser(_ context.Context, _ database.DBTX, userID int64) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	now := time.Now()
	for _, t := range r.tokens {
		if t.UserID == userID && t.RevokedAt == nil {
			t.RevokedAt = &now
		}
	}
	return nil
}

func (r *fakeRepo) activeTokens() int {
	r.mu.Lock()
	defer r.mu.Unlock()
	n := 0
	for _, t := range r.tokens {
		if t.RevokedAt == nil {
			n++
		}
	}
	return n
}
