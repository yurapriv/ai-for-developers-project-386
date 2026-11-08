package api

import (
	"fmt"
	"net/http"
	"testing"
	"time"
)

func TestAvailabilityRejectsUnknownMeetingType(t *testing.T) {
	s := startServer(t)
	response := s.do(t, http.MethodGet, "/availability?meetingTypeId=999&day=2026-01-01", nil)
	if response.StatusCode != http.StatusNotFound {
		t.Fatalf("unknown meeting type: got %s, want 404", response.Status)
	}
}

func TestAvailabilityCalendarAndSlots(t *testing.T) {
	now, _ := time.Parse(time.RFC3339, "2026-12-31T05:59:59Z")
	s := bookingAcceptanceServer(t, func() time.Time { return now })
	a := s.createType(t, "45", "test", 45)
	b := s.createType(t, "30", "test", 30)
	c := s.createType(t, "540", "test", 540)
	type response struct {
		Window struct {
			FirstDay string `json:"firstDay"`
			LastDay  string `json:"lastDay"`
			TimeZone string `json:"timeZone"`
		} `json:"window"`
		Slots []struct {
			Start time.Time `json:"start"`
			End   time.Time `json:"end"`
		} `json:"slots"`
	}
	get := func(id int64, day string, status int) response {
		t.Helper()
		r := s.do(t, http.MethodGet, fmt.Sprintf("/availability?meetingTypeId=%d&day=%s", id, day), nil)
		defer func() { _ = r.Body.Close() }()
		if r.StatusCode != status {
			t.Fatalf("day %s: got %s want %d", day, r.Status, status)
		}
		var v response
		if status == http.StatusOK {
			mustRead(t, r, &v)
		}
		return v
	}
	get(a.ID, "2026-12-30", 422)
	get(a.ID, "2027-01-14", 422)
	get(a.ID, "2026-02-30", 422)
	v := get(a.ID, "2026-12-31", 200)
	if v.Window.FirstDay != "2026-12-31" || v.Window.LastDay != "2027-01-13" || v.Window.TimeZone != "Europe/Moscow" {
		t.Fatalf("window: %+v", v.Window)
	}
	if len(v.Slots) != 17 || v.Slots[0].Start.Format(time.RFC3339) != "2026-12-31T09:00:00+03:00" || v.Slots[16].End.Format(time.RFC3339) != "2026-12-31T17:45:00+03:00" {
		t.Fatalf("45-minute slots: %+v", v.Slots)
	}
	for i := 1; i < len(v.Slots); i++ {
		if v.Slots[i].Start.Sub(v.Slots[i-1].Start) != 30*time.Minute {
			t.Fatal("wrong grid")
		}
	}
	v = get(b.ID, "2026-12-31", 200)
	if len(v.Slots) != 18 || v.Slots[17].End.Format(time.RFC3339) != "2026-12-31T18:00:00+03:00" {
		t.Fatal("30-minute boundary")
	}
	v = get(c.ID, "2026-12-31", 200)
	if len(v.Slots) != 1 {
		t.Fatal("540-minute boundary")
	}
	now = now.Add(time.Second)
	v = get(c.ID, "2026-12-31", 200)
	if len(v.Slots) != 0 {
		t.Fatal("start equal to now must be excluded")
	}
	now, _ = time.Parse(time.RFC3339, "2026-12-31T07:00:00Z")
	v = get(b.ID, "2026-12-31", 200)
	if len(v.Slots) == 0 || v.Slots[0].Start.Format(time.RFC3339) != "2026-12-31T10:30:00+03:00" {
		t.Fatal("past and equal starts must be excluded")
	}
	now, _ = time.Parse(time.RFC3339, "2026-12-31T15:00:00Z")
	if len(get(b.ID, "2026-12-31", 200).Slots) != 0 {
		t.Fatal("no starts after workday")
	}
	now, _ = time.Parse(time.RFC3339, "2026-12-31T21:00:00Z")
	v = get(a.ID, "2027-01-01", 200)
	if v.Window.FirstDay != "2027-01-01" || v.Window.LastDay != "2027-01-14" {
		t.Fatalf("midnight window: %+v", v.Window)
	}
	get(a.ID, "2026-12-31", 422)
	get(a.ID, "2027-01-14", 200)
	now, _ = time.Parse(time.RFC3339, "2026-04-30T20:59:59Z")
	v = get(a.ID, "2026-05-13", 200)
	if v.Window.FirstDay != "2026-04-30" || v.Window.LastDay != "2026-05-13" {
		t.Fatalf("month boundary: %+v", v.Window)
	}
	now = now.Add(time.Second)
	v = get(a.ID, "2026-05-14", 200)
	if v.Window.FirstDay != "2026-05-01" || v.Window.LastDay != "2026-05-14" {
		t.Fatalf("month midnight: %+v", v.Window)
	}
}
