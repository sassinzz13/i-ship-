// Package storage abstracts binary file storage (proof-of-delivery images).
// LocalStore writes to a directory on a Docker volume; an object-storage
// implementation (S3, R2, MinIO) can satisfy the same interface later.
package storage

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type FileStore interface {
	// Save stores r under a generated key with the given prefix and extension
	// and returns that key.
	Save(ctx context.Context, prefix, ext string, r io.Reader) (string, error)
	Open(ctx context.Context, key string) (io.ReadCloser, error)
	Delete(ctx context.Context, key string) error
}

var ErrNotFound = errors.New("file not found")

type LocalStore struct{ root string }

func NewLocalStore(root string) (*LocalStore, error) {
	if err := os.MkdirAll(root, 0o750); err != nil {
		return nil, fmt.Errorf("create upload dir: %w", err)
	}
	return &LocalStore{root: root}, nil
}

func (s *LocalStore) Save(_ context.Context, prefix, ext string, r io.Reader) (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	key := filepath.ToSlash(filepath.Join(sanitize(prefix), time.Now().UTC().Format("2006/01"), hex.EncodeToString(b)+ext))
	full, err := s.path(key)
	if err != nil {
		return "", err
	}
	if err := os.MkdirAll(filepath.Dir(full), 0o750); err != nil {
		return "", err
	}
	f, err := os.OpenFile(full, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o640)
	if err != nil {
		return "", err
	}
	if _, err := io.Copy(f, r); err != nil {
		f.Close()
		_ = os.Remove(full)
		return "", err
	}
	return key, f.Close()
}

func (s *LocalStore) Open(_ context.Context, key string) (io.ReadCloser, error) {
	full, err := s.path(key)
	if err != nil {
		return nil, err
	}
	f, err := os.Open(full)
	if errors.Is(err, os.ErrNotExist) {
		return nil, ErrNotFound
	}
	return f, err
}

func (s *LocalStore) Delete(_ context.Context, key string) error {
	full, err := s.path(key)
	if err != nil {
		return err
	}
	if err := os.Remove(full); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	return nil
}

// path resolves key inside root, rejecting traversal.
func (s *LocalStore) path(key string) (string, error) {
	clean := filepath.Clean("/" + key)
	full := filepath.Join(s.root, clean)
	rootAbs, _ := filepath.Abs(s.root)
	fullAbs, _ := filepath.Abs(full)
	if !strings.HasPrefix(fullAbs, rootAbs+string(os.PathSeparator)) {
		return "", errors.New("invalid storage key")
	}
	return full, nil
}

func sanitize(s string) string {
	return strings.Map(func(r rune) rune {
		if r >= 'a' && r <= 'z' || r >= '0' && r <= '9' || r == '-' || r == '_' {
			return r
		}
		return -1
	}, strings.ToLower(s))
}
