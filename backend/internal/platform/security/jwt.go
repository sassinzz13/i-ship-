package security

import (
	"errors"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const issuer = "i-ship"

type accessClaims struct {
	Email      string `json:"email"`
	Role       Role   `json:"role"`
	CustomerID *int64 `json:"cid,omitempty"`
	DriverID   *int64 `json:"did,omitempty"`
	jwt.RegisteredClaims
}

// TokenManager issues and verifies HS256 access tokens.
type TokenManager struct {
	secret []byte
	ttl    time.Duration
	now    func() time.Time
}

func NewTokenManager(secret string, ttl time.Duration) *TokenManager {
	return &TokenManager{secret: []byte(secret), ttl: ttl, now: time.Now}
}

func (m *TokenManager) TTL() time.Duration { return m.ttl }

// WithClock is used by tests to control token timestamps.
func (m *TokenManager) WithClock(now func() time.Time) *TokenManager {
	cp := *m
	cp.now = now
	return &cp
}

// Issue returns a signed access token for p and its expiry time.
func (m *TokenManager) Issue(p Principal) (string, time.Time, error) {
	now := m.now()
	exp := now.Add(m.ttl)
	claims := accessClaims{
		Email: p.Email, Role: p.Role, CustomerID: p.CustomerID, DriverID: p.DriverID,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    issuer,
			Subject:   strconv.FormatInt(p.UserID, 10),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(exp),
		},
	}
	tok, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(m.secret)
	return tok, exp, err
}

var ErrInvalidToken = errors.New("invalid token")

// Verify parses and validates a token, returning its principal.
func (m *TokenManager) Verify(token string) (Principal, error) {
	var claims accessClaims
	_, err := jwt.ParseWithClaims(token, &claims, func(t *jwt.Token) (any, error) {
		return m.secret, nil
	},
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithIssuer(issuer),
		jwt.WithExpirationRequired(),
		jwt.WithTimeFunc(m.now),
	)
	if err != nil {
		return Principal{}, ErrInvalidToken
	}
	id, err := strconv.ParseInt(claims.Subject, 10, 64)
	if err != nil || !claims.Role.Valid() {
		return Principal{}, ErrInvalidToken
	}
	return Principal{UserID: id, Email: claims.Email, Role: claims.Role, CustomerID: claims.CustomerID, DriverID: claims.DriverID}, nil
}
