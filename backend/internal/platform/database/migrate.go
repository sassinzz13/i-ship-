package database

import (
	"errors"
	"fmt"
	"io/fs"
	"strings"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/pgx/v5"
	"github.com/golang-migrate/migrate/v4/source/iofs"
)

// Migrator applies the SQL migrations embedded in the binary.
type Migrator struct{ m *migrate.Migrate }

func NewMigrator(files fs.FS, databaseURL string) (*Migrator, error) {
	src, err := iofs.New(files, ".")
	if err != nil {
		return nil, fmt.Errorf("load migrations: %w", err)
	}
	// golang-migrate's pgx driver is registered under the pgx5 scheme.
	url := databaseURL
	for _, prefix := range []string{"postgres://", "postgresql://"} {
		if strings.HasPrefix(url, prefix) {
			url = "pgx5://" + strings.TrimPrefix(url, prefix)
		}
	}
	m, err := migrate.NewWithSourceInstance("iofs", src, url)
	if err != nil {
		return nil, fmt.Errorf("init migrator: %w", err)
	}
	return &Migrator{m: m}, nil
}

func (mg *Migrator) Up() error   { return ignoreNoChange(mg.m.Up()) }
func (mg *Migrator) Down() error { return ignoreNoChange(mg.m.Down()) }
func (mg *Migrator) Steps(n int) error {
	return ignoreNoChange(mg.m.Steps(n))
}

func (mg *Migrator) Version() (uint, bool, error) {
	v, dirty, err := mg.m.Version()
	if errors.Is(err, migrate.ErrNilVersion) {
		return 0, false, nil
	}
	return v, dirty, err
}

func (mg *Migrator) Close() {
	_, _ = mg.m.Close()
}

func ignoreNoChange(err error) error {
	if errors.Is(err, migrate.ErrNoChange) {
		return nil
	}
	return err
}
