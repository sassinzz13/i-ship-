package shipments

// Status is a shipment lifecycle state.
type Status string

const (
	StatusPending        Status = "PENDING"
	StatusConfirmed      Status = "CONFIRMED"
	StatusPickedUp       Status = "PICKED_UP"
	StatusInTransit      Status = "IN_TRANSIT"
	StatusOutForDelivery Status = "OUT_FOR_DELIVERY"
	StatusDelivered      Status = "DELIVERED"
	StatusFailedDelivery Status = "FAILED_DELIVERY"
	StatusReturned       Status = "RETURNED"
	StatusCancelled      Status = "CANCELLED"
)

var AllStatuses = []Status{
	StatusPending, StatusConfirmed, StatusPickedUp, StatusInTransit, StatusOutForDelivery,
	StatusDelivered, StatusFailedDelivery, StatusReturned, StatusCancelled,
}

// transitions is the shipment state machine. Every status change, manual or
// automatic, must follow an edge in this graph.
var transitions = map[Status][]Status{
	StatusPending:        {StatusConfirmed, StatusCancelled},
	StatusConfirmed:      {StatusPickedUp, StatusCancelled},
	StatusPickedUp:       {StatusInTransit, StatusReturned},
	StatusInTransit:      {StatusOutForDelivery, StatusReturned},
	StatusOutForDelivery: {StatusDelivered, StatusFailedDelivery},
	StatusFailedDelivery: {StatusOutForDelivery, StatusReturned},
	StatusDelivered:      {},
	StatusReturned:       {},
	StatusCancelled:      {},
}

// systemOnly statuses are reached through the assignment and delivery flows
// (driver starts a run, records an attempt or proof of delivery), never by
// the manual status endpoint.
var systemOnly = map[Status]bool{
	StatusOutForDelivery: true,
	StatusDelivered:      true,
	StatusFailedDelivery: true,
}

func (s Status) Valid() bool {
	_, ok := transitions[s]
	return ok
}

func (s Status) Terminal() bool { return len(transitions[s]) == 0 }

// CanTransition reports whether from → to is an edge of the state machine.
func CanTransition(from, to Status) bool {
	for _, n := range transitions[from] {
		if n == to {
			return true
		}
	}
	return false
}

// ManualTransitions lists the statuses an operator may set from `from`.
func ManualTransitions(from Status) []Status {
	out := []Status{}
	for _, n := range transitions[from] {
		if !systemOnly[n] {
			out = append(out, n)
		}
	}
	return out
}

// IsManualAllowed reports whether an operator may move from → to directly.
func IsManualAllowed(from, to Status) bool { return CanTransition(from, to) && !systemOnly[to] }

// forwardPath is the happy path used to advance a shipment to
// OUT_FOR_DELIVERY when a driver starts a delivery run.
var forwardPath = []Status{StatusPending, StatusConfirmed, StatusPickedUp, StatusInTransit, StatusOutForDelivery}

// PathTo returns the sequence of statuses that moves a shipment from `from`
// to `target` along valid edges, or nil if no such forward path exists.
func PathTo(from, target Status) []Status {
	if CanTransition(from, target) {
		return []Status{target}
	}
	start := -1
	for i, s := range forwardPath {
		if s == from {
			start = i
		}
	}
	if start < 0 {
		return nil
	}
	for i := start + 1; i < len(forwardPath); i++ {
		if forwardPath[i] == target {
			return forwardPath[start+1 : i+1]
		}
	}
	return nil
}
