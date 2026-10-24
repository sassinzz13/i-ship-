package notifications

import (
	"context"

	"github.com/sassinzz13/i-ship/backend/internal/platform/database"
	"github.com/sassinzz13/i-ship/backend/internal/shared/utilities"
)

type Repository interface {
	Insert(ctx context.Context, q database.DBTX, userID int64, m Message) error
	InsertForRoles(ctx context.Context, q database.DBTX, roles []string, m Message) error
	List(ctx context.Context, q database.DBTX, userID int64, unreadOnly bool, p utilities.Pagination) ([]Notification, int, error)
	UnreadCount(ctx context.Context, q database.DBTX, userID int64) (int, error)
	MarkRead(ctx context.Context, q database.DBTX, userID, id int64) (bool, error)
	MarkAllRead(ctx context.Context, q database.DBTX, userID int64) error
}

type PGRepository struct{}

func NewRepository() *PGRepository { return &PGRepository{} }

func (PGRepository) Insert(ctx context.Context, q database.DBTX, userID int64, m Message) error {
	_, err := q.Exec(ctx, `INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id)
		VALUES ($1, $2, $3, $4, NULLIF($5, ''), NULLIF($6, 0))`, userID, m.Type, m.Title, m.Message, m.EntityType, m.EntityID)
	return err
}

func (PGRepository) InsertForRoles(ctx context.Context, q database.DBTX, roles []string, m Message) error {
	_, err := q.Exec(ctx, `INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id)
		SELECT u.id, $2, $3, $4, NULLIF($5, ''), NULLIF($6, 0)
		FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = ANY($1) AND u.is_active`,
		roles, m.Type, m.Title, m.Message, m.EntityType, m.EntityID)
	return err
}

func (PGRepository) List(ctx context.Context, q database.DBTX, userID int64, unreadOnly bool, p utilities.Pagination) ([]Notification, int, error) {
	var total int
	if err := q.QueryRow(ctx, `SELECT count(*) FROM notifications WHERE user_id = $1 AND (NOT $2 OR read_at IS NULL)`,
		userID, unreadOnly).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := q.Query(ctx, `SELECT id, type, title, message, entity_type, entity_id, read_at, created_at
		FROM notifications WHERE user_id = $1 AND (NOT $2 OR read_at IS NULL)
		ORDER BY created_at DESC, id DESC LIMIT $3 OFFSET $4`, userID, unreadOnly, p.Limit(), p.Offset())
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := []Notification{}
	for rows.Next() {
		var n Notification
		if err := rows.Scan(&n.ID, &n.Type, &n.Title, &n.Message, &n.EntityType, &n.EntityID, &n.ReadAt, &n.CreatedAt); err != nil {
			return nil, 0, err
		}
		out = append(out, n)
	}
	return out, total, rows.Err()
}

func (PGRepository) UnreadCount(ctx context.Context, q database.DBTX, userID int64) (int, error) {
	var n int
	err := q.QueryRow(ctx, `SELECT count(*) FROM notifications WHERE user_id = $1 AND read_at IS NULL`, userID).Scan(&n)
	return n, err
}

func (PGRepository) MarkRead(ctx context.Context, q database.DBTX, userID, id int64) (bool, error) {
	tag, err := q.Exec(ctx, `UPDATE notifications SET read_at = COALESCE(read_at, now()) WHERE id = $1 AND user_id = $2`, id, userID)
	return tag.RowsAffected() > 0, err
}

func (PGRepository) MarkAllRead(ctx context.Context, q database.DBTX, userID int64) error {
	_, err := q.Exec(ctx, `UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL`, userID)
	return err
}
