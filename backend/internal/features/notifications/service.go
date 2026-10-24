package notifications

import (
	"context"

	"github.com/sassinzz13/i-ship/backend/internal/platform/database"
	apperr "github.com/sassinzz13/i-ship/backend/internal/shared/errors"
	"github.com/sassinzz13/i-ship/backend/internal/shared/utilities"
)

// Notifier is what other features depend on to create notifications.
type Notifier interface {
	Notify(ctx context.Context, q database.DBTX, userID int64, m Message) error
	NotifyRoles(ctx context.Context, q database.DBTX, roles []string, m Message) error
}

type Service struct {
	db   database.DBTX
	repo Repository
}

func NewService(db database.DBTX, repo Repository) *Service { return &Service{db: db, repo: repo} }

func (s *Service) Notify(ctx context.Context, q database.DBTX, userID int64, m Message) error {
	return s.repo.Insert(ctx, q, userID, m)
}

func (s *Service) NotifyRoles(ctx context.Context, q database.DBTX, roles []string, m Message) error {
	return s.repo.InsertForRoles(ctx, q, roles, m)
}

func (s *Service) List(ctx context.Context, userID int64, unreadOnly bool, p utilities.Pagination) ([]Notification, int, error) {
	out, total, err := s.repo.List(ctx, s.db, userID, unreadOnly, p)
	if err != nil {
		return nil, 0, apperr.Internal(err)
	}
	return out, total, nil
}

func (s *Service) UnreadCount(ctx context.Context, userID int64) (int, error) {
	n, err := s.repo.UnreadCount(ctx, s.db, userID)
	if err != nil {
		return 0, apperr.Internal(err)
	}
	return n, nil
}

func (s *Service) MarkRead(ctx context.Context, userID, id int64) error {
	ok, err := s.repo.MarkRead(ctx, s.db, userID, id)
	if err != nil {
		return apperr.Internal(err)
	}
	if !ok {
		return apperr.NotFound("Notification not found")
	}
	return nil
}

func (s *Service) MarkAllRead(ctx context.Context, userID int64) error {
	if err := s.repo.MarkAllRead(ctx, s.db, userID); err != nil {
		return apperr.Internal(err)
	}
	return nil
}
