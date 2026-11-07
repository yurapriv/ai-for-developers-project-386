package server

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"sort"
	"strings"
	"sync"
	"time"
	_ "time/tzdata"
	"unicode"
	"unicode/utf8"

	middleware "github.com/oapi-codegen/nethttp-middleware"
	"github.com/yurapriv/ai-for-developers-project-386/internal/api"
	"github.com/yurapriv/ai-for-developers-project-386/internal/catalog"
)

const (
	fieldValidationMessage  = "Проверьте данные формы"
	malformedRequestMessage = "Данные запроса не соответствуют форме"
	// Test-only isolation hook for browser scenarios; outside the API contract.
	testOnlyResetPath  = "/__e2e/reset"
	testOnlyResetRoute = http.MethodPost + " " + testOnlyResetPath
)

// operations implements the generated strict server for the calendar booking API.
type operations struct {
	meetingTypes *catalog.Store
	now          func() time.Time
	location     *time.Location
	bookings     *bookingStore
}

type bookingStore struct {
	mu    sync.Mutex
	items []api.Booking
}

func (s *bookingStore) occupied(start, end time.Time) bool {
	for _, b := range s.items {
		if start.Before(b.End) && b.Start.Before(end) {
			return true
		}
	}
	return false
}

var _ api.StrictServerInterface = operations{}

func (operations) GetHealth(_ context.Context, _ api.GetHealthRequestObject) (api.GetHealthResponseObject, error) {
	return api.GetHealth200JSONResponse{Status: api.Ok}, nil
}

func (o operations) window(now time.Time) api.BookingWindow {
	local := now.In(o.location)
	day := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, o.location)
	return api.BookingWindow{FirstDay: day.Format("2006-01-02"), LastDay: day.AddDate(0, 0, 13).Format("2006-01-02"), TimeZone: "Europe/Moscow"}
}

func (o operations) GetBookingWindow(_ context.Context, _ api.GetBookingWindowRequestObject) (api.GetBookingWindowResponseObject, error) {
	return api.GetBookingWindow200JSONResponse(o.window(o.now())), nil
}

func (o operations) GetAvailability(_ context.Context, req api.GetAvailabilityRequestObject) (api.GetAvailabilityResponseObject, error) {
	var duration int64
	for _, item := range o.meetingTypes.List() {
		if item.Id == req.Params.MeetingTypeId {
			duration = item.DurationMinutes
			break
		}
	}
	if duration == 0 {
		return api.GetAvailability404JSONResponse(problem("Тип встречи не найден", nil)), nil
	}
	now := o.now()
	window := o.window(now)
	day, err := time.ParseInLocation("2006-01-02", req.Params.Day, o.location)
	if err != nil || day.Format("2006-01-02") != req.Params.Day || req.Params.Day < window.FirstDay || req.Params.Day > window.LastDay {
		return api.GetAvailability422JSONResponse(problem("Выберите день в окне записи", nil)), nil
	}
	slots := []api.Slot{}
	o.bookings.mu.Lock()
	defer o.bookings.mu.Unlock()
	start := day.Add(9 * time.Hour)
	endOfDay := day.Add(18 * time.Hour)
	for ; !start.Add(time.Duration(duration) * time.Minute).After(endOfDay); start = start.Add(30 * time.Minute) {
		if start.After(now) && !o.bookings.occupied(start, start.Add(time.Duration(duration)*time.Minute)) {
			slots = append(slots, api.Slot{Start: start, End: start.Add(time.Duration(duration) * time.Minute)})
		}
	}
	return api.GetAvailability200JSONResponse{Window: window, Slots: slots}, nil
}

func (o operations) CreateBooking(_ context.Context, req api.CreateBookingRequestObject) (api.CreateBookingResponseObject, error) {
	b := req.Body
	var meetingType api.MeetingType
	for _, item := range o.meetingTypes.List() {
		if item.Id == b.MeetingTypeId {
			meetingType = api.MeetingType{Id: item.Id, Name: item.Name, Description: item.Description, DurationMinutes: item.DurationMinutes}
			break
		}
	}
	if meetingType.DurationMinutes == 0 {
		return api.CreateBooking404JSONResponse(problem("Тип встречи не найден", nil)), nil
	}
	name, email := strings.TrimSpace(b.Name), strings.TrimSpace(b.Email)
	var fields []catalog.FieldError
	if utf8.RuneCountInString(name) < 1 || utf8.RuneCountInString(name) > 100 {
		fields = append(fields, catalog.FieldError{Field: "name", Message: "Введите имя от 1 до 100 символов"})
	}
	parts := strings.Split(email, "@")
	if utf8.RuneCountInString(email) > 254 || len(parts) != 2 || parts[0] == "" || parts[1] == "" || strings.IndexFunc(email, unicode.IsSpace) >= 0 {
		fields = append(fields, catalog.FieldError{Field: "email", Message: "Введите корректный email"})
	}
	if len(fields) > 0 {
		return api.CreateBooking422JSONResponse(problem(fieldValidationMessage, fields)), nil
	}
	o.bookings.mu.Lock()
	defer o.bookings.mu.Unlock()
	now := o.now()
	start := b.Start.In(o.location)
	end := start.Add(time.Duration(meetingType.DurationMinutes) * time.Minute)
	day := start.Format("2006-01-02")
	window := o.window(now)
	minute := start.Hour()*60 + start.Minute()
	if !start.After(now) || day < window.FirstDay || day > window.LastDay || minute < 540 || (minute-540)%30 != 0 || start.Second() != 0 || start.Nanosecond() != 0 || end.After(time.Date(start.Year(), start.Month(), start.Day(), 18, 0, 0, 0, o.location)) {
		return api.CreateBooking422JSONResponse(problem("Выберите допустимое время в окне записи", nil)), nil
	}
	if o.bookings.occupied(start, end) {
		return api.CreateBooking409JSONResponse(problem("Это время уже занято. Выберите другой свободный слот", nil)), nil
	}
	booking := api.Booking{MeetingType: meetingType, Start: start, End: end, Name: name, Email: email}
	o.bookings.items = append(o.bookings.items, booking)
	return api.CreateBooking201JSONResponse(booking), nil
}

func (o operations) ListUpcomingBookings(_ context.Context, _ api.ListUpcomingBookingsRequestObject) (api.ListUpcomingBookingsResponseObject, error) {
	o.bookings.mu.Lock()
	defer o.bookings.mu.Unlock()
	now := o.now()
	items := make(api.ListUpcomingBookings200JSONResponse, 0)
	for _, booking := range o.bookings.items {
		if booking.Start.After(now) {
			items = append(items, booking)
		}
	}
	sort.Slice(items, func(i, j int) bool { return items[i].Start.Before(items[j].Start) })
	return items, nil
}

func (o operations) ListMeetingTypes(_ context.Context, _ api.ListMeetingTypesRequestObject) (api.ListMeetingTypesResponseObject, error) {
	stored := o.meetingTypes.List()
	items := make(api.ListMeetingTypes200JSONResponse, 0, len(stored))
	for _, item := range stored {
		items = append(items, api.MeetingType{
			Id:              item.Id,
			Name:            item.Name,
			Description:     item.Description,
			DurationMinutes: item.DurationMinutes,
		})
	}
	return items, nil
}

func (o operations) CreateMeetingType(_ context.Context, request api.CreateMeetingTypeRequestObject) (api.CreateMeetingTypeResponseObject, error) {
	body := request.Body
	input, fieldErrors := catalog.Sanitize(body.Name, body.Description, body.DurationMinutes)
	if len(fieldErrors) != 0 {
		return api.CreateMeetingType422JSONResponse(problem(fieldValidationMessage, fieldErrors)), nil
	}
	created := o.meetingTypes.Create(input)
	return api.CreateMeetingType201JSONResponse{
		Id:              created.Id,
		Name:            created.Name,
		Description:     created.Description,
		DurationMinutes: created.DurationMinutes,
	}, nil
}

func problem(message string, fieldErrors []catalog.FieldError) api.Problem {
	fields := make([]api.FieldProblem, 0, len(fieldErrors))
	for _, fieldError := range fieldErrors {
		fields = append(fields, api.FieldProblem{Field: fieldError.Field, Message: fieldError.Message})
	}
	return api.Problem{Message: message, Fields: fields}
}

// writeProblem answers with the contract conforming Problem body when the
// request never reaches a business handler: broken schemas, wrong types.
func writeProblem(w http.ResponseWriter, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnprocessableEntity)
	_ = json.NewEncoder(w).Encode(api.Problem{Message: message, Fields: []api.FieldProblem{}})
}

// isTestModeEnabled reports whether the isolated-state reset hook is allowed.
// The browser test environment sets E2E_MODE=1; production runs never do.
func isTestModeEnabled() bool {
	return os.Getenv("E2E_MODE") == "1"
}

func NewHandler() (http.Handler, error) {
	return NewHandlerWithClock(time.Now)
}

// NewHandlerWithClock permits deterministic time at the application boundary.
func NewHandlerWithClock(now func() time.Time) (http.Handler, error) {
	location, err := time.LoadLocation("Europe/Moscow")
	if err != nil {
		return nil, err
	}
	spec, err := api.GetSpec()
	if err != nil {
		return nil, err
	}
	if err := spec.Validate(context.Background()); err != nil {
		return nil, err
	}
	ops := operations{meetingTypes: catalog.NewStore(), now: now, location: location, bookings: &bookingStore{}}
	strict := api.NewStrictHandlerWithOptions(ops, nil, api.StrictHTTPServerOptions{
		// Requests that cannot be decoded still answer with the declared Problem body.
		RequestErrorHandlerFunc: func(w http.ResponseWriter, _ *http.Request, _ error) {
			writeProblem(w, malformedRequestMessage)
		},
	})
	mux := http.NewServeMux()
	handler := api.HandlerFromMux(strict, mux)
	if isTestModeEnabled() {
		// Test-only hook outside the contract: resets in-memory state for isolated browser scenarios.
		mux.HandleFunc(testOnlyResetRoute, func(w http.ResponseWriter, _ *http.Request) {
			ops.bookings.mu.Lock()
			defer ops.bookings.mu.Unlock()
			ops.bookings.items = nil
			ops.meetingTypes.Reset()
			w.WriteHeader(http.StatusNoContent)
		})
	}
	return middleware.OapiRequestValidatorWithOptions(spec, &middleware.Options{
		Skipper: func(request *http.Request) bool {
			return request.Method == http.MethodPost && request.URL.Path == testOnlyResetPath
		},
		ErrorHandlerWithOpts: func(_ context.Context, err error, w http.ResponseWriter, _ *http.Request, opts middleware.ErrorHandlerOpts) {
			if opts.MatchedRoute == nil {
				// Routes outside the contract keep the middleware default answer.
				http.Error(w, err.Error(), opts.StatusCode)
				return
			}
			writeProblem(w, malformedRequestMessage)
		},
	})(handler), nil
}
