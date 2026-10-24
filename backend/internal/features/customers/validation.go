package customers

import (
	"strings"

	apperr "github.com/sassinzz13/i-ship/backend/internal/shared/errors"
)

// normalize trims input and applies business rules shared by create and
// update.
func normalize(f *Fields) error {
	f.FullName = strings.TrimSpace(f.FullName)
	f.Phone = strings.TrimSpace(f.Phone)
	f.CompanyName = trimPtr(f.CompanyName)
	f.Notes = trimPtr(f.Notes)
	if f.Email != nil {
		e := strings.ToLower(strings.TrimSpace(*f.Email))
		f.Email = &e
		if e == "" {
			f.Email = nil
		}
	}
	if f.CustomerType == "" {
		f.CustomerType = TypeIndividual
	}
	if f.CustomerType == TypeBusiness && f.CompanyName == nil {
		return apperr.Validation("Business customers need a company name", map[string]any{"companyName": "is required for business customers"})
	}
	if f.FullName == "" {
		return apperr.Validation("Name is required", map[string]any{"fullName": "is required"})
	}
	return nil
}

func trimPtr(s *string) *string {
	if s == nil {
		return nil
	}
	t := strings.TrimSpace(*s)
	if t == "" {
		return nil
	}
	return &t
}
