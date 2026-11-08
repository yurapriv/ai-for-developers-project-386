package api

import (
	"fmt"
	"net/http"
	"reflect"
	"sync/atomic"
	"testing"
	"time"
)

func bookingSlots(t *testing.T, s *apiServer, typeID int64) []time.Time {
	t.Helper()
	r := s.do(t, http.MethodGet, fmt.Sprintf("/availability?meetingTypeId=%d&day=2026-12-31", typeID), nil)
	if r.StatusCode != http.StatusOK {
		t.Fatalf("availability: %s", r.Status)
	}
	var body struct {
		Slots []struct {
			Start time.Time `json:"start"`
		} `json:"slots"`
	}
	mustRead(t, r, &body)
	starts := make([]time.Time, 0, len(body.Slots))
	for _, slot := range body.Slots {
		starts = append(starts, slot.Start)
	}
	return starts
}

func containsStart(starts []time.Time, start time.Time) bool {
	for _, candidate := range starts {
		if candidate.Equal(start) {
			return true
		}
	}
	return false
}

func TestBookingRejectsNestedIntervalsInBothDirections(t *testing.T) {
	for _, tc := range []struct {
		name             string
		existingDuration int64
		existingStart    string
		requestDuration  int64
		requestStart     string
	}{
		{"requested interval inside existing", 120, "2026-12-31T10:00:00+03:00", 30, "2026-12-31T10:30:00+03:00"},
		{"existing interval inside requested", 30, "2026-12-31T10:30:00+03:00", 120, "2026-12-31T10:00:00+03:00"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			now, _ := time.Parse(time.RFC3339, "2026-12-31T05:00:00Z")
			s := bookingAcceptanceServer(t, func() time.Time { return now })
			existing := s.createType(t, "Существующая", "Описание", tc.existingDuration)
			requested := s.createType(t, "Новая", "Описание", tc.requestDuration)
			post := func(id int64, start string) *http.Response {
				return s.do(t, http.MethodPost, "/bookings", map[string]any{"meetingTypeId": id, "start": start, "name": "Тест", "email": "test@example.test"})
			}
			if r := post(existing.ID, tc.existingStart); r.StatusCode != http.StatusCreated {
				t.Fatalf("existing booking: %s", r.Status)
			}
			before := bookingSlots(t, s, requested.ID)
			nestedStart, err := time.Parse(time.RFC3339, tc.requestStart)
			if err != nil {
				t.Fatal(err)
			}
			if containsStart(before, nestedStart) {
				t.Fatal("nested interval offered as available")
			}
			if r := post(requested.ID, tc.requestStart); r.StatusCode != http.StatusConflict {
				t.Fatalf("nested booking: %s, want 409", r.Status)
			}
			if after := bookingSlots(t, s, requested.ID); !reflect.DeepEqual(before, after) {
				t.Fatal("rejected booking changed availability")
			}
		})
	}
}

func TestDisplayedSlotBecomesStaleBeforeBooking(t *testing.T) {
	initial, _ := time.Parse(time.RFC3339, "2026-12-31T06:59:59Z")
	var clock atomic.Int64
	clock.Store(initial.UnixNano())
	s := bookingAcceptanceServer(t, func() time.Time { return time.Unix(0, clock.Load()) })
	typ := s.createType(t, "Час", "Описание", 60)
	start, _ := time.Parse(time.RFC3339, "2026-12-31T10:00:00+03:00")
	if !containsStart(bookingSlots(t, s, typ.ID), start) {
		t.Fatal("future slot was not offered")
	}
	clock.Store(start.UnixNano())
	before := bookingSlots(t, s, typ.ID)
	next := start.Add(30 * time.Minute)
	if containsStart(before, start) || !containsStart(before, next) {
		t.Fatal("availability did not update when slot reached its start")
	}
	r := s.do(t, http.MethodPost, "/bookings", map[string]any{"meetingTypeId": typ.ID, "start": start.Format(time.RFC3339), "name": "Тест", "email": "test@example.test"})
	if r.StatusCode != http.StatusUnprocessableEntity {
		t.Fatalf("stale booking: %s, want 422", r.Status)
	}
	if after := bookingSlots(t, s, typ.ID); !reflect.DeepEqual(before, after) {
		t.Fatal("rejected stale booking changed availability")
	}
	r = s.do(t, http.MethodPost, "/bookings", map[string]any{"meetingTypeId": typ.ID, "start": next.Format(time.RFC3339), "name": "Тест", "email": "test@example.test"})
	if r.StatusCode != http.StatusCreated {
		t.Fatalf("future adjacent-grid booking after stale refusal: %s, want 201", r.Status)
	}
}
