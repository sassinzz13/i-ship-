package security

import (
	"errors"

	"golang.org/x/crypto/bcrypt"
)

const bcryptCost = 12

// MinPasswordLength is enforced on every password set through the API.
const MinPasswordLength = 8

// HashPassword returns a bcrypt hash of the password.
func HashPassword(password string) (string, error) {
	if len(password) > 72 {
		return "", errors.New("password must be at most 72 bytes")
	}
	b, err := bcrypt.GenerateFromPassword([]byte(password), bcryptCost)
	return string(b), err
}

// CheckPassword reports whether password matches hash, in constant time.
func CheckPassword(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

// dummyHash lets login spend the same time on unknown emails as on known ones.
var dummyHash, _ = bcrypt.GenerateFromPassword([]byte("i-ship-timing-equalizer"), bcryptCost)

// CheckDummy performs a throwaway comparison to equalize response timing.
func CheckDummy(password string) {
	_ = bcrypt.CompareHashAndPassword(dummyHash, []byte(password))
}
