package database

import (
	"context"

	"github.com/jackc/pgx/v5"
)

// Transactor runs fn in a transaction. *TxManager implements it; tests can
// substitute an implementation that calls fn directly.
type Transactor interface {
	WithTx(ctx context.Context, fn func(tx pgx.Tx) error) error
}

var _ Transactor = (*TxManager)(nil)
