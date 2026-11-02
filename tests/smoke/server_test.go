package smoke

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/getkin/kin-openapi/routers/gorillamux"
)

func TestServerStartsAndMatchesContract(t *testing.T) {
	root, err := filepath.Abs(filepath.Join("..", ".."))
	if err != nil {
		t.Fatal(err)
	}
	name := "server"
	if runtime.GOOS == "windows" {
		name += ".exe"
	}
	binary := filepath.Join(t.TempDir(), name)
	buildCtx, cancelBuild := context.WithTimeout(t.Context(), 90*time.Second)
	defer cancelBuild()
	build := exec.CommandContext(buildCtx, "go", "build", "-o", binary, "./cmd/server")
	build.Dir = root
	if output, err := build.CombinedOutput(); err != nil {
		t.Fatalf("build: %v\n%s", err, output)
	}

	cmd := exec.Command(binary)
	cmd.Dir = root
	for _, entry := range os.Environ() {
		if !strings.HasPrefix(entry, "LISTEN_ADDR=") {
			cmd.Env = append(cmd.Env, entry)
		}
	}
	cmd.Env = append(cmd.Env, "LISTEN_ADDR=127.0.0.1:0")
	cmd.Stderr = os.Stderr
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		t.Fatal(err)
	}
	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}
	done := make(chan struct{})
	var exitErr error
	go func() { exitErr = cmd.Wait(); close(done) }()
	t.Cleanup(func() {
		select {
		case <-done:
		default:
			_ = cmd.Process.Kill()
			select {
			case <-done:
			case <-time.After(5 * time.Second):
				t.Error("server did not exit after kill")
			}
		}
	})

	type startup struct {
		Event   string `json:"event"`
		Address string `json:"address"`
	}
	ready := make(chan startup, 1)
	decodeErr := make(chan error, 1)
	go func() {
		var value startup
		if err := json.NewDecoder(io.LimitReader(stdout, 4096)).Decode(&value); err != nil {
			decodeErr <- err
			return
		}
		ready <- value
	}()
	var address string
	select {
	case value := <-ready:
		if value.Event != "listening" {
			t.Fatalf("unexpected startup event: %q", value.Event)
		}
		host, port, err := net.SplitHostPort(value.Address)
		if err != nil || host != "127.0.0.1" || port == "0" {
			t.Fatalf("invalid address: %q", value.Address)
		}
		address = value.Address
	case err := <-decodeErr:
		t.Fatalf("startup output: %v", err)
	case <-done:
		t.Fatalf("server exited before ready: %v", exitErr)
	case <-time.After(10 * time.Second):
		t.Fatal("server startup timeout")
	}

	spec, err := openapi3.NewLoader().LoadFromFile(filepath.Join(root, "api", "generated", "openapi.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	if err := spec.Validate(t.Context()); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "http://"+address+"/health", nil)
	if err != nil {
		t.Fatal(err)
	}
	client := &http.Client{CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse }}
	defer client.CloseIdleConnections()
	response, err := client.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = response.Body.Close() }()
	if response.StatusCode != http.StatusOK {
		t.Fatalf("status: %d", response.StatusCode)
	}
	if err := validateResponse(ctx, spec, req, response); err != nil {
		t.Fatal(err)
	}

	t.Run("validator rejects incorrect body", func(t *testing.T) {
		invalid := &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": []string{"application/json"}},
			Body:       io.NopCloser(strings.NewReader(`{"status":"broken"}`)),
		}
		defer func() { _ = invalid.Body.Close() }()
		if err := validateResponse(t.Context(), spec, req, invalid); err == nil {
			t.Fatal("contract validator accepted an invalid body")
		}
	})
}

func validateResponse(ctx context.Context, spec *openapi3.T, req *http.Request, response *http.Response) error {
	if response.Header.Get("Content-Type") != "application/json" {
		return fmt.Errorf("unexpected content type: %s", response.Header.Get("Content-Type"))
	}
	router, err := gorillamux.NewRouter(spec)
	if err != nil {
		return err
	}
	route, params, err := router.FindRoute(req)
	if err != nil {
		return err
	}
	return openapi3filter.ValidateResponse(ctx, &openapi3filter.ResponseValidationInput{
		RequestValidationInput: &openapi3filter.RequestValidationInput{Request: req, Route: route, PathParams: params},
		Status:                 response.StatusCode,
		Header:                 response.Header,
		Body:                   response.Body,
		Options:                &openapi3filter.Options{IncludeResponseStatus: true},
	})
}
