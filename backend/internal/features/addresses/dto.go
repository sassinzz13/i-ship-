package addresses

type AddressRequest struct {
	Label        string   `json:"label" binding:"omitempty,max=40"`
	ContactName  string   `json:"contactName" binding:"required,min=1,max=120"`
	ContactPhone string   `json:"contactPhone" binding:"required,min=5,max=30"`
	Line1        string   `json:"line1" binding:"required,min=1,max=200"`
	Line2        *string  `json:"line2" binding:"omitempty,max=200"`
	Barangay     *string  `json:"barangay" binding:"omitempty,max=100"`
	City         string   `json:"city" binding:"required,min=1,max=100"`
	Province     string   `json:"province" binding:"required,min=1,max=100"`
	PostalCode   *string  `json:"postalCode" binding:"omitempty,max=10"`
	Country      string   `json:"country" binding:"omitempty,len=2"`
	Latitude     *float64 `json:"latitude" binding:"omitempty,gte=-90,lte=90"`
	Longitude    *float64 `json:"longitude" binding:"omitempty,gte=-180,lte=180"`
	IsDefault    bool     `json:"isDefault"`
}

func (r AddressRequest) fields() Fields {
	return Fields{
		Label: r.Label, ContactName: r.ContactName, ContactPhone: r.ContactPhone, Line1: r.Line1, Line2: r.Line2,
		Barangay: r.Barangay, City: r.City, Province: r.Province, PostalCode: r.PostalCode, Country: r.Country,
		Latitude: r.Latitude, Longitude: r.Longitude, IsDefault: r.IsDefault,
	}
}
