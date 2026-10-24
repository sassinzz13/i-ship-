package addresses

import "strings"

func normalize(f *Fields) {
	f.Label = strings.TrimSpace(f.Label)
	if f.Label == "" {
		f.Label = "Home"
	}
	f.ContactName = strings.TrimSpace(f.ContactName)
	f.ContactPhone = strings.TrimSpace(f.ContactPhone)
	f.Line1 = strings.TrimSpace(f.Line1)
	f.City = strings.TrimSpace(f.City)
	f.Province = strings.TrimSpace(f.Province)
	f.Country = strings.ToUpper(strings.TrimSpace(f.Country))
	if f.Country == "" {
		f.Country = "PH"
	}
	for _, p := range []**string{&f.Line2, &f.Barangay, &f.PostalCode} {
		if *p != nil {
			t := strings.TrimSpace(**p)
			if t == "" {
				*p = nil
			} else {
				*p = &t
			}
		}
	}
}
