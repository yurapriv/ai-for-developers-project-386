// Package catalog holds the meeting type catalog of the single calendar owner.
// Types live in memory: ids are assigned by the application, duplicates of
// names are allowed, and restarts drop all data (documented in README.md).
package catalog

import (
	"strings"
	"sync"
	"unicode/utf8"
)

const (
	nameMaxRunes        = 100
	descriptionMaxRunes = 2000
	minDurationMinutes  = 1
	maxDurationMinutes  = 540
)

// MeetingType is a stored meeting type with its application-assigned id.
type MeetingType struct {
	Id              int64
	Name            string
	Description     string
	DurationMinutes int64
}

// FieldError describes one form field problem in language shown to the owner.
type FieldError struct {
	Field   string
	Message string
}

// Input is sanitized meeting type data ready to be stored.
type Input struct {
	Name            string
	Description     string
	DurationMinutes int64
}

// Sanitize trims the edge spaces of the texts, validates the trimmed values
// and reports one error per invalid field. When it returns no errors,
// the cleaned input is ready for Store.Create.
func Sanitize(name, description string, durationMinutes int64) (Input, []FieldError) {
	name = strings.TrimSpace(name)
	description = strings.TrimSpace(description)
	fieldErrors := []FieldError{}
	switch {
	case name == "":
		fieldErrors = append(fieldErrors, FieldError{Field: "name", Message: "Укажите название"})
	case utf8.RuneCountInString(name) > nameMaxRunes:
		fieldErrors = append(fieldErrors, FieldError{Field: "name", Message: "Название должно быть от 1 до 100 символов"})
	}
	switch {
	case description == "":
		fieldErrors = append(fieldErrors, FieldError{Field: "description", Message: "Укажите описание"})
	case utf8.RuneCountInString(description) > descriptionMaxRunes:
		fieldErrors = append(fieldErrors, FieldError{Field: "description", Message: "Описание должно быть от 1 до 2000 символов"})
	}
	if durationMinutes < minDurationMinutes || durationMinutes > maxDurationMinutes {
		fieldErrors = append(fieldErrors, FieldError{Field: "durationMinutes", Message: "Длительность должна быть целым числом от 1 до 540 минут"})
	}
	if len(fieldErrors) != 0 {
		return Input{}, fieldErrors
	}
	return Input{Name: name, Description: description, DurationMinutes: durationMinutes}, nil
}

// Store keeps types in creation order and guards access with a mutex.
type Store struct {
	mu           sync.Mutex
	nextId       int64
	meetingTypes []MeetingType
}

func NewStore() *Store {
	return &Store{}
}

// Create appends the type with a fresh id; it keeps creation order.
func (s *Store) Create(input Input) MeetingType {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.nextId++
	created := MeetingType{
		Id:              s.nextId,
		Name:            input.Name,
		Description:     input.Description,
		DurationMinutes: input.DurationMinutes,
	}
	s.meetingTypes = append(s.meetingTypes, created)
	return created
}

// List returns a copy of all types, earliest created first.
func (s *Store) List() []MeetingType {
	s.mu.Lock()
	defer s.mu.Unlock()
	items := make([]MeetingType, len(s.meetingTypes))
	copy(items, s.meetingTypes)
	return items
}

// Reset empties the catalog; the test environment only invokes it for isolated browser scenarios.
func (s *Store) Reset() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.nextId = 0
	s.meetingTypes = nil
}
