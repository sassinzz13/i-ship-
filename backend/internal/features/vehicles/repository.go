package vehicles

import (
	"context"
	"fmt"
	"strings"

	"github.com/sassinzz13/i-ship/backend/internal/platform/database"
	"github.com/sassinzz13/i-ship/backend/internal/shared/utilities"
)

type Repository interface {
	List(ctx context.Context, q database.DBTX, f ListFilter, p utilities.Pagination, s utilities.Sort) ([]Vehicle, int, error)
	Get(ctx context.Context, q database.DBTX, id int64, forUpdate bool) (*Vehicle, error)
	Insert(ctx context.Context, q database.DBTX, v VehicleRequest) (int64, error)
	Update(ctx context.Context, q database.DBTX, id int64, v VehicleRequest) error
	SetStatus(ctx context.Context, q database.DBTX, id int64, status string) error
}

type PGRepository struct{}

func NewRepository() *PGRepository { return &PGRepository{} }

const cols = `id, plate_number, vehicle_type, brand, model, year, weight_capacity_kg::float8, status, created_at, updated_at`

func scan(row interface{ Scan(...any) error }) (Vehicle, error) {
	var v Vehicle
	err := row.Scan(&v.ID, &v.PlateNumber, &v.VehicleType, &v.Brand, &v.Model, &v.Year, &v.WeightCapacityKg, &v.Status, &v.CreatedAt, &v.UpdatedAt)
	return v, err
}

func (PGRepository) List(ctx context.Context, q database.DBTX, f ListFilter, p utilities.Pagination, s utilities.Sort) ([]Vehicle, int, error) {
	where := []string{"TRUE"}
	var args []any
	arg := func(v any) string { args = append(args, v); return fmt.Sprintf("$%d", len(args)) }
	if f.Search != "" {
		n := arg(utilities.LikePattern(f.Search))
		where = append(where, fmt.Sprintf("(plate_number ILIKE %[1]s OR brand ILIKE %[1]s OR model ILIKE %[1]s)", n))
	}
	if f.Status != "" {
		where = append(where, "status = "+arg(f.Status))
	}
	if f.VehicleType != "" {
		where = append(where, "vehicle_type = "+arg(f.VehicleType))
	}
	cond := strings.Join(where, " AND ")
	var total int
	if err := q.QueryRow(ctx, `SELECT count(*) FROM vehicles WHERE `+cond, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	lim, off := arg(p.Limit()), arg(p.Offset())
	rows, err := q.Query(ctx, `SELECT `+cols+` FROM vehicles WHERE `+cond+` ORDER BY `+s.SQL()+`, id LIMIT `+lim+` OFFSET `+off, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := []Vehicle{}
	for rows.Next() {
		v, err := scan(rows)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, v)
	}
	return out, total, rows.Err()
}

func (PGRepository) Get(ctx context.Context, q database.DBTX, id int64, forUpdate bool) (*Vehicle, error) {
	sql := `SELECT ` + cols + ` FROM vehicles WHERE id = $1`
	if forUpdate {
		sql += ` FOR UPDATE`
	}
	v, err := scan(q.QueryRow(ctx, sql, id))
	if database.IsNoRows(err) {
		return nil, nil
	}
	return &v, err
}

func (PGRepository) Insert(ctx context.Context, q database.DBTX, v VehicleRequest) (int64, error) {
	var id int64
	err := q.QueryRow(ctx, `INSERT INTO vehicles (plate_number, vehicle_type, brand, model, year, weight_capacity_kg, status)
		VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
		v.PlateNumber, v.VehicleType, v.Brand, v.Model, v.Year, v.WeightCapacityKg, v.Status).Scan(&id)
	return id, err
}

func (PGRepository) Update(ctx context.Context, q database.DBTX, id int64, v VehicleRequest) error {
	_, err := q.Exec(ctx, `UPDATE vehicles SET plate_number=$2, vehicle_type=$3, brand=$4, model=$5, year=$6,
		weight_capacity_kg=$7, status=$8 WHERE id = $1`,
		id, v.PlateNumber, v.VehicleType, v.Brand, v.Model, v.Year, v.WeightCapacityKg, v.Status)
	return err
}

func (PGRepository) SetStatus(ctx context.Context, q database.DBTX, id int64, status string) error {
	_, err := q.Exec(ctx, `UPDATE vehicles SET status = $2 WHERE id = $1`, id, status)
	return err
}
