package api

import (
	"net/http"
	"strings"
	"testing"
)

type meetingTypeJSON struct {
	ID              int64  `json:"id"`
	Name            string `json:"name"`
	Description     string `json:"description"`
	DurationMinutes int64  `json:"durationMinutes"`
}

type fieldProblemJSON struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

type problemJSON struct {
	Message string             `json:"message"`
	Fields  []fieldProblemJSON `json:"fields"`
}

func meetingTypePayload(name, description string, duration any) map[string]any {
	return map[string]any{"name": name, "description": description, "durationMinutes": duration}
}

func repeatSymbols(symbol string, count int) string {
	return strings.Repeat(symbol, count)
}

// sendCreate sends the payload and reports the outcome without asserting success.
func (s *apiServer) sendCreate(t *testing.T, payload map[string]any) (int, meetingTypeJSON, problemJSON) {
	t.Helper()
	response := s.do(t, http.MethodPost, "/meeting-types", payload)
	defer func() { _ = response.Body.Close() }()

	var created meetingTypeJSON
	var problem problemJSON
	switch response.StatusCode {
	case http.StatusCreated:
		mustRead(t, response, &created)
	case http.StatusUnprocessableEntity:
		mustRead(t, response, &problem)
	default:
		t.Fatalf("create meeting type: unexpected status %d", response.StatusCode)
	}
	return response.StatusCode, created, problem
}

// tryCreate exposes the status and problem of a possibly invalid payload.
func (s *apiServer) tryCreate(t *testing.T, payload map[string]any) (int, problemJSON) {
	status, _, problem := s.sendCreate(t, payload)
	return status, problem
}

// createType creates a valid meeting type and fails the test otherwise.
func (s *apiServer) createType(t *testing.T, name, description string, durationMinutes int64) meetingTypeJSON {
	t.Helper()
	status, created, problem := s.sendCreate(t, meetingTypePayload(name, description, durationMinutes))
	if status != http.StatusCreated {
		t.Fatalf("create type: expected 201, got %d, problem %+v", status, problem)
	}
	return created
}

// catalog returns the meeting type catalog in the order the server reports it.
func (s *apiServer) catalog(t *testing.T) []meetingTypeJSON {
	t.Helper()
	response := s.do(t, http.MethodGet, "/meeting-types", nil)
	defer func() { _ = response.Body.Close() }()
	if response.StatusCode != http.StatusOK {
		t.Fatalf("catalog: expected 200, got %d", response.StatusCode)
	}
	var items []meetingTypeJSON
	mustRead(t, response, &items)
	return items
}

func (s *apiServer) requireNoTypes(t *testing.T) {
	t.Helper()
	if items := s.catalog(t); len(items) != 0 {
		t.Fatalf("expected empty catalog, got %+v", items)
	}
}

func requireFieldProblem(t *testing.T, problem problemJSON, field string) fieldProblemJSON {
	t.Helper()
	for _, item := range problem.Fields {
		if item.Field == field {
			return item
		}
	}
	t.Fatalf("problem %q has no error for field %q", problem.Message, field)
	return fieldProblemJSON{}
}

// requireRejection asserts a 422 response with a problem for the given field.
func (s *apiServer) requireRejection(t *testing.T, payload map[string]any, field string) {
	t.Helper()
	status, problem := s.tryCreate(t, payload)
	if status != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422, got %d, problem %+v", status, problem)
	}
	requireFieldProblem(t, problem, field)
}

// requireContractRejection asserts the normalized 422 problem for payloads the
// contract schema itself rejects (wrong JSON types, missing fields); such
// responses do not carry per-field problems.
func (s *apiServer) requireContractRejection(t *testing.T, payload map[string]any) {
	t.Helper()
	status, problem := s.tryCreate(t, payload)
	if status != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422, got %d, problem %+v", status, problem)
	}
	if problem.Message == "" {
		t.Fatal("problem message is empty")
	}
	if len(problem.Fields) != 0 {
		t.Fatalf("contract rejections must not invent field problems: %+v", problem.Fields)
	}
}

func TestEmptyCatalogShowsNoTypes(t *testing.T) {
	startServer(t).requireNoTypes(t)
}

func TestCreatedTypeIsVisibleToGuests(t *testing.T) {
	server := startServer(t)
	created := server.createType(t, "Знакомство", "Короткая встреча, чтобы обсудить задачу.", 30)
	if created.ID == 0 {
		t.Fatal("server returned an empty id")
	}
	items := server.catalog(t)
	if len(items) != 1 {
		t.Fatalf("catalog contains %d items, want 1", len(items))
	}
	if items[0] != created {
		t.Fatalf("catalog item %+v differs from created %+v", items[0], created)
	}
}

func TestServerAssignsStableIdAndIgnoresClientId(t *testing.T) {
	server := startServer(t)
	payload := meetingTypePayload("Знакомство", "Короткое знакомство.", 30)
	payload["id"] = int64(963)
	status, created, problem := server.sendCreate(t, payload)
	if status != http.StatusCreated {
		t.Fatalf("unexpected status %d: %+v", status, problem)
	}
	if created.ID == 963 || created.ID == 0 {
		t.Fatalf("server must assign its own id, got %d", created.ID)
	}
	for _, item := range server.catalog(t) {
		if item.ID != created.ID {
			t.Fatalf("id changed between create and catalog: %d then %d", created.ID, item.ID)
		}
	}
}

func TestCatalogKeepsCreationOrderEarliestFirst(t *testing.T) {
	server := startServer(t)
	created := []meetingTypeJSON{
		server.createType(t, "Знакомство", "Первое предложение.", 30),
		server.createType(t, "Обсуждение задачи", "Подробный разбор.", 45),
		server.createType(t, "Ретроспектива", "Итоги недели.", 35),
	}
	for attempt := 0; attempt < 2; attempt++ {
		items := server.catalog(t)
		if len(items) != len(created) {
			t.Fatalf("catalog has %d items, want %d", len(items), len(created))
		}
		for index, want := range created {
			if items[index].ID != want.ID {
				t.Fatalf("position %d: id %d, want %d (creation order)", index, items[index].ID, want.ID)
			}
		}
	}
}

func TestDuplicateNamesGetDifferentIds(t *testing.T) {
	server := startServer(t)
	first := server.createType(t, "Беседа", "Разговор без предопределённой повестки.", 20)
	second := server.createType(t, "Беседа", "То же название, другое описание.", 20)
	if first.ID == second.ID {
		t.Fatalf("identical names produced equal ids: %d", first.ID)
	}
	items := server.catalog(t)
	if len(items) != 2 || items[0].Name != "Беседа" || items[1].Name != "Беседа" {
		t.Fatalf("catalog must contain both identical-named types: %+v", items)
	}
}

func TestNameLengthBoundaries(t *testing.T) {
	server := startServer(t)
	t.Run("1 символ принимается", func(t *testing.T) {
		created := server.createType(t, "А", "Описание достаточно подробное, чтобы пройти проверку.", 30)
		if created.Name != "А" {
			t.Fatalf("name: %q", created.Name)
		}
	})
	t.Run("100 символов принимаются", func(t *testing.T) {
		name := repeatSymbols("я", 100)
		created := server.createType(t, name, "Описание", 10)
		if created.Name != name {
			t.Fatalf("name length: %d", len([]rune(created.Name)))
		}
	})
	t.Run("101 символ отклоняется", func(t *testing.T) {
		server.requireRejection(t, meetingTypePayload(repeatSymbols("я", 101), "Описание", 30), "name")
	})
	t.Run("только пробелы отклоняются", func(t *testing.T) {
		server.requireRejection(t, meetingTypePayload("   \n\t", "Описание", 30), "name")
	})
}

func TestDescriptionLengthBoundaries(t *testing.T) {
	server := startServer(t)
	t.Run("1 символ принимается", func(t *testing.T) {
		created := server.createType(t, "Знакомство", "Я", 30)
		if created.Description != "Я" {
			t.Fatalf("description: %q", created.Description)
		}
	})
	t.Run("2000 символов принимаются", func(t *testing.T) {
		description := repeatSymbols("п", 2000)
		created := server.createType(t, "Знакомство", description, 30)
		if created.Description != description {
			t.Fatalf("description length: %d", len([]rune(created.Description)))
		}
	})
	t.Run("2001 символ отклоняется", func(t *testing.T) {
		server.requireRejection(t, meetingTypePayload("Знакомство", repeatSymbols("п", 2001), 30), "description")
	})
	t.Run("только пробелы отклоняются", func(t *testing.T) {
		server.requireRejection(t, meetingTypePayload("Знакомство", " \t ", 30), "description")
	})
}

func TestEdgeSpacesAreTrimmedBeforeValidation(t *testing.T) {
	server := startServer(t)
	// 100 значимых символов плюс пробелы по краям: допустимо после удаления пробелов.
	name := "  " + repeatSymbols("я", 100) + "  "
	description := "  Обсудим " + repeatSymbols("п", 1992) + "  "
	created := server.createType(t, name, description, 30)
	if created.Name != repeatSymbols("я", 100) {
		t.Fatalf("stored name must be trimmed, length %d", len([]rune(created.Name)))
	}
	if !strings.HasPrefix(created.Description, "Обсудим") {
		t.Fatal("stored description must be trimmed")
	}
	for _, item := range server.catalog(t) {
		if item.ID != created.ID {
			continue
		}
		if item.Name != repeatSymbols("я", 100) || item.Description != created.Description {
			t.Fatalf("catalog keeps untrimmed values: %+v", item)
		}
	}
}

func TestRussianTextsPassThroughExactly(t *testing.T) {
	server := startServer(t)
	name := "Разбор портфолио с «Ё» и запятой"
	description := "Обсудим проекты, цели и статью «Как оформление похоже на шаблон». Поговорим о программе Хекслет: «ИИ для разработчиков»."
	created := server.createType(t, name, description, 35)
	if created.Name != name || created.Description != description {
		t.Fatalf("russian texts changed during round trip: %+v", created)
	}
	if item := server.catalog(t)[0]; item.Name != name {
		t.Fatalf("catalog lost russian text: %+v", item)
	}
}

func TestDurationBoundaries(t *testing.T) {
	server := startServer(t)
	t.Run("1 минута принимается", func(t *testing.T) {
		created := server.createType(t, "Экспресс-привет", "Одна короткая минута.", 1)
		if created.DurationMinutes != 1 {
			t.Fatalf("duration: %d", created.DurationMinutes)
		}
	})
	t.Run("540 минут принимаются", func(t *testing.T) {
		created := server.createType(t, "Полный рабочий день", "Ровно девять часов.", 540)
		if created.DurationMinutes != 540 {
			t.Fatalf("duration: %d", created.DurationMinutes)
		}
	})
	t.Run("не кратное 30 принимается", func(t *testing.T) {
		created := server.createType(t, "Кофейный разговор", "Сорок пять минут.", 45)
		if created.DurationMinutes != 45 {
			t.Fatalf("duration: %d", created.DurationMinutes)
		}
	})
	t.Run("ноль отклоняется", func(t *testing.T) {
		server.requireRejection(t, meetingTypePayload("Знакомство", "Описание", 0), "durationMinutes")
	})
	t.Run("отрицательное отклоняется", func(t *testing.T) {
		server.requireRejection(t, meetingTypePayload("Знакомство", "Описание", -1), "durationMinutes")
	})
	t.Run("541 отклоняется", func(t *testing.T) {
		server.requireRejection(t, meetingTypePayload("Знакомство", "Описание", 541), "durationMinutes")
	})
	t.Run("дробное отклоняется", func(t *testing.T) {
		server.requireContractRejection(t, meetingTypePayload("Знакомство", "Описание", 3.5))
	})
	t.Run("строка вместо числа отклоняется", func(t *testing.T) {
		server.requireContractRejection(t, meetingTypePayload("Знакомство", "Описание", "30"))
	})
}

func TestEmptyObjectIsRejected(t *testing.T) {
	server := startServer(t)
	status, problem := server.tryCreate(t, map[string]any{})
	if status != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422, got %d", status)
	}
	if problem.Message == "" {
		t.Fatal("problem message is empty")
	}
	if len(problem.Fields) != 0 {
		t.Fatalf("schema violations must not invent field problems: %+v", problem.Fields)
	}
	server.requireNoTypes(t)
}

func TestSchemaInvalidPayloadsHaveNoFieldProblems(t *testing.T) {
	server := startServer(t)
	// Valid JSON that does not match the contract schema (name must be a string).
	payload := meetingTypePayload("Знакомство", "Описание", 30)
	payload["name"] = []any{1, 2}
	status, problem := server.tryCreate(t, payload)
	if status != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422, got %d", status)
	}
	if len(problem.Fields) != 0 {
		t.Fatalf("schema violations must not invent field problems: %+v", problem.Fields)
	}
	if problem.Message == "" {
		t.Fatal("problem message is empty")
	}
	server.requireNoTypes(t)
}

func TestFailedCreatesDoNotMutateCatalog(t *testing.T) {
	server := startServer(t)
	server.createType(t, "Знакомство", "Первый тип.", 30)
	before := server.catalog(t)
	rejections := []map[string]any{
		meetingTypePayload("", "Пустое название.", 30),
		meetingTypePayload("Название есть", "   ", 30),
		meetingTypePayload("Название есть", "Описание есть", 0),
		meetingTypePayload(repeatSymbols("я", 101), "Описание есть", 30),
	}
	for _, payload := range rejections {
		status, problem := server.tryCreate(t, payload)
		if status != http.StatusUnprocessableEntity {
			t.Fatalf("expected 422 for %+v, got %d", payload, status)
		}
		if problem.Message == "" {
			t.Fatalf("problem for %+v has no message", payload)
		}
	}
	after := server.catalog(t)
	if len(after) != len(before) {
		t.Fatalf("failed creates changed the catalog size: before %d, after %d", len(before), len(after))
	}
	for index := range before {
		if after[index] != before[index] {
			t.Fatalf("failed creates changed catalog item %d: %+v → %+v", index, before[index], after[index])
		}
	}
}

func TestRestartResetsCatalog(t *testing.T) {
	server := startServer(t)
	server.createType(t, "Знакомство", "Исчезнет после перезапуска.", 30)
	server.stop(t)

	restarted := startServer(t)
	restarted.requireNoTypes(t)
}
