package api

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/yurapriv/ai-for-developers-project-386/internal/server"
)

func TestBookingOccupiesCalendar(t *testing.T) {
	now, _ := time.Parse(time.RFC3339, "2026-12-31T05:00:00Z")
	handler, err := server.NewHandlerWithClock(func() time.Time { return now })
	if err != nil {
		t.Fatal(err)
	}
	httpServer := httptest.NewServer(handler)
	defer httpServer.Close()
	contract, err := loadContract()
	if err != nil {
		t.Fatal(err)
	}
	s := &apiServer{address: strings.TrimPrefix(httpServer.URL, "http://"), client: httpServer.Client(), spec: contract.spec, router: contract.router}
	typ := s.createType(t, "Встреча", "Описание", 45)
	payload := map[string]any{"meetingTypeId": typ.ID, "start": "2026-12-31T10:00:00+03:00", "name": " Guest ", "email": " guest@example.test "}
	r := s.do(t, http.MethodPost, "/bookings", payload)
	if r.StatusCode != http.StatusCreated {
		t.Fatalf("booking: %s", r.Status)
	}
	r = s.do(t, http.MethodPost, "/bookings", payload)
	if r.StatusCode != http.StatusConflict {
		t.Fatalf("repeat: %s", r.Status)
	}
}

func TestConcurrentOverlappingBookings(t *testing.T) {
	now, _ := time.Parse(time.RFC3339, "2026-12-31T05:00:00Z")
	handler, err := server.NewHandlerWithClock(func() time.Time { return now })
	if err != nil {
		t.Fatal(err)
	}
	httpServer := httptest.NewServer(handler)
	defer httpServer.Close()
	contract, err := loadContract()
	if err != nil {
		t.Fatal(err)
	}
	s := &apiServer{address: strings.TrimPrefix(httpServer.URL, "http://"), client: httpServer.Client(), spec: contract.spec, router: contract.router}
	a := s.createType(t, "Час", "Описание", 60)
	b := s.createType(t, "Полчаса", "Описание", 30)
	ready := make(chan struct{})
	results := make(chan int, 2)
	for _, input := range []struct {
		id    int64
		start string
	}{{a.ID, "2026-12-31T10:00:00+03:00"}, {b.ID, "2026-12-31T10:30:00+03:00"}} {
		go func() {
			<-ready
			r := s.do(t, http.MethodPost, "/bookings", map[string]any{"meetingTypeId": input.id, "start": input.start, "name": "Тест", "email": "test@example.test"})
			results <- r.StatusCode
		}()
	}
	close(ready)
	x, y := <-results, <-results
	if (x != 201 || y != 409) && (x != 409 || y != 201) {
		t.Fatalf("statuses: %d, %d", x, y)
	}
	list := s.do(t, http.MethodGet, "/bookings", nil)
	var bookings []struct {
		Name string `json:"name"`
	}
	mustRead(t, list, &bookings)
	if len(bookings) != 1 || bookings[0].Name != "Тест" {
		t.Fatalf("expected exactly one successful booking: %+v", bookings)
	}
	r := s.do(t, http.MethodGet, fmt.Sprintf("/availability?meetingTypeId=%d&day=2026-12-31", a.ID), nil)
	var availability struct {
		Slots []struct {
			Start time.Time `json:"start"`
		} `json:"slots"`
	}
	mustRead(t, r, &availability)
	for _, slot := range availability.Slots {
		if slot.Start.Format("15:04") == "10:00" || slot.Start.Format("15:04") == "10:30" {
			t.Fatal("occupied slot offered")
		}
	}
}

func TestBookingValidationAndIntervals(t *testing.T) {
	now, _ := time.Parse(time.RFC3339, "2026-12-31T05:00:00Z")
	handler, err := server.NewHandlerWithClock(func() time.Time { return now })
	if err != nil {
		t.Fatal(err)
	}
	httpServer := httptest.NewServer(handler)
	defer httpServer.Close()
	contract, err := loadContract()
	if err != nil {
		t.Fatal(err)
	}
	s := &apiServer{address: strings.TrimPrefix(httpServer.URL, "http://"), client: httpServer.Client(), spec: contract.spec, router: contract.router}
	long := s.createType(t, "Час", "Описание", 60)
	short := s.createType(t, "Полчаса", "Описание", 30)
	post := func(id int64, start, name, email string, status int) *http.Response {
		t.Helper()
		r := s.do(t, http.MethodPost, "/bookings", map[string]any{"meetingTypeId": id, "start": start, "name": name, "email": email, "durationMinutes": 1, "end": "2026-12-31T10:01:00+03:00"})
		if r.StatusCode != status {
			t.Fatalf("%s %s: got %s want %d", start, email, r.Status, status)
		}
		return r
	}
	post(999, "2026-12-31T10:00:00+03:00", "Имя", "a@b", 404)
	for _, email := range []string{"", "abc", "a@@b", "a @b", "@b", "a@", strings.Repeat("a", 253) + "@b"} {
		post(long.ID, "2026-12-31T10:00:00+03:00", "Имя", email, 422)
	}
	post(long.ID, "2026-12-31T10:00:00+03:00", " ", "a@b", 422)
	for _, start := range []string{"2026-12-30T10:00:00+03:00", "2027-01-14T10:00:00+03:00", "2026-12-31T08:30:00+03:00", "2026-12-31T10:15:00+03:00", "2026-12-31T17:30:00+03:00"} {
		post(long.ID, start, "Имя", "a@b", 422)
	}
	r := post(long.ID, "2026-12-31T10:00:00+03:00", " Имя ", " a@b ", 201)
	var booking struct {
		Name  string    `json:"name"`
		Email string    `json:"email"`
		Start time.Time `json:"start"`
		End   time.Time `json:"end"`
	}
	mustRead(t, r, &booking)
	if booking.Name != "Имя" || booking.Email != "a@b" || booking.End.Sub(booking.Start) != time.Hour {
		t.Fatalf("booking: %+v", booking)
	}
	post(short.ID, "2026-12-31T07:00:00Z", "Имя", "a@b", 409)
	post(short.ID, "2026-12-31T10:30:00+03:00", "Имя", "a@b", 409)
	post(long.ID, "2026-12-31T09:30:00+03:00", "Имя", "a@b", 409)
	post(short.ID, "2026-12-31T11:00:00+03:00", "Имя", "a@b", 201)
	now, _ = time.Parse(time.RFC3339, "2026-12-31T09:00:00Z")
	post(short.ID, "2026-12-31T12:00:00+03:00", "Имя", "a@b", 422)
}
