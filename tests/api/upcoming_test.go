package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/yurapriv/ai-for-developers-project-386/internal/server"
)

func TestUpcomingBookingsEmpty(t *testing.T) {
	now, _ := time.Parse(time.RFC3339, "2026-12-31T05:00:00Z")
	handler, err := server.NewHandlerWithClock(func() time.Time { return now })
	if err != nil {
		t.Fatal(err)
	}
	s := httptest.NewServer(handler)
	defer s.Close()
	response, err := s.Client().Get(s.URL + "/bookings")
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = response.Body.Close() }()
	if response.StatusCode != http.StatusOK {
		t.Fatalf("status: %s", response.Status)
	}
	var bookings []json.RawMessage
	if err := json.NewDecoder(response.Body).Decode(&bookings); err != nil {
		t.Fatal(err)
	}
	if bookings == nil || len(bookings) != 0 {
		t.Fatalf("expected empty array, got %v", bookings)
	}
}

func TestUpcomingBookingsIncludesAllTypesAndExcludesStarted(t *testing.T) {
	now, _ := time.Parse(time.RFC3339, "2026-12-31T05:00:00Z")
	s := bookingAcceptanceServer(t, func() time.Time { return now })
	a := s.createType(t, "Час", "Описание", 60)
	b := s.createType(t, "Сорок пять минут", "Описание", 45)
	for _, booking := range []struct {
		id                 int64
		start, name, email string
	}{
		{b.ID, "2027-01-13T10:00:00+03:00", "Поздний", "late@example.test"},
		{a.ID, "2026-12-31T10:00:00+03:00", "Первый", "first@example.test"},
		{b.ID, "2026-12-31T11:00:00+03:00", "Второй", "second@example.test"},
	} {
		r := s.do(t, http.MethodPost, "/bookings", map[string]any{"meetingTypeId": booking.id, "start": booking.start, "name": booking.name, "email": booking.email})
		if r.StatusCode != http.StatusCreated {
			t.Fatalf("create: %s", r.Status)
		}
	}
	r := s.do(t, http.MethodPost, "/bookings", map[string]any{"meetingTypeId": a.ID, "start": "2026-12-31T10:00:00+03:00", "name": "Лишний", "email": "x@y"})
	if r.StatusCode != http.StatusConflict {
		t.Fatalf("conflict: %s", r.Status)
	}
	// Advancing the clock also moves the booking window; future stored records remain visible.
	now, _ = time.Parse(time.RFC3339, "2026-12-31T08:00:00Z")
	r = s.do(t, http.MethodGet, "/bookings", nil)
	var items []struct {
		MeetingType struct {
			Name     string `json:"name"`
			Duration int    `json:"durationMinutes"`
		} `json:"meetingType"`
		Start time.Time `json:"start"`
		End   time.Time `json:"end"`
		Name  string    `json:"name"`
		Email string    `json:"email"`
	}
	mustRead(t, r, &items)
	if len(items) != 1 || items[0].MeetingType.Name != "Сорок пять минут" || items[0].MeetingType.Duration != 45 || items[0].Name != "Поздний" || items[0].Email != "late@example.test" || items[0].Start.Format(time.RFC3339) != "2027-01-13T10:00:00+03:00" || items[0].End.Format(time.RFC3339) != "2027-01-13T10:45:00+03:00" {
		t.Fatalf("unexpected list: %+v", items)
	}
	// Rewind only the test clock: the last stored meeting is now beyond the 14-day window.
	now, _ = time.Parse(time.RFC3339, "2026-12-30T05:00:00Z")
	r = s.do(t, http.MethodGet, "/bookings", nil)
	mustRead(t, r, &items)
	if len(items) != 3 || items[0].Name != "Первый" || items[1].Name != "Второй" || items[2].Name != "Поздний" {
		t.Fatalf("unexpected order: %+v", items)
	}
}
