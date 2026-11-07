// Package api contains contract-level HTTP tests for the meeting type catalog.
// Tests run the real server process and validate every response against the
// generated OpenAPI specification, like tests/smoke does.
package api

import (
	"bytes"
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
	"sync"
	"testing"
	"time"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/getkin/kin-openapi/routers"
	"github.com/getkin/kin-openapi/routers/gorillamux"
)

func repositoryRoot() (string, error) {
	return filepath.Abs(filepath.Join("..", ".."))
}

var buildServer = sync.OnceValues(func() (string, error) {
	root, err := repositoryRoot()
	if err != nil {
		return "", err
	}
	name := "server"
	if runtime.GOOS == "windows" {
		name += ".exe"
	}
	binary := filepath.Join(os.TempDir(), fmt.Sprintf("catalog-tests-%d", os.Getpid()), name)
	if err := os.MkdirAll(filepath.Dir(binary), 0o755); err != nil {
		return "", err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	build := exec.CommandContext(ctx, "go", "build", "-o", binary, "./cmd/server")
	build.Dir = root
	if output, err := build.CombinedOutput(); err != nil {
		return "", fmt.Errorf("build: %w\n%s", err, output)
	}
	return binary, nil
})

type contract struct {
	spec   *openapi3.T
	router routers.Router
}

var loadContract = sync.OnceValues(func() (contract, error) {
	root, err := repositoryRoot()
	if err != nil {
		return contract{}, err
	}
	spec, err := openapi3.NewLoader().LoadFromFile(filepath.Join(root, "api", "generated", "openapi.yaml"))
	if err != nil {
		return contract{}, err
	}
	if err := spec.Validate(context.Background()); err != nil {
		return contract{}, err
	}
	router, err := gorillamux.NewRouter(spec)
	if err != nil {
		return contract{}, err
	}
	return contract{spec: spec, router: router}, nil
})

// apiServer is one isolated server process per test invocation.
type apiServer struct {
	root    string
	address string
	client  *http.Client
	spec    *openapi3.T
	router  routers.Router

	cmd  *exec.Cmd
	done chan struct{}
}

func startServer(t *testing.T) *apiServer {
	t.Helper()
	root, err := repositoryRoot()
	if err != nil {
		t.Fatal(err)
	}
	binary, err := buildServer()
	if err != nil {
		t.Fatal(err)
	}
	api, err := loadContract()
	if err != nil {
		t.Fatal(err)
	}

	cmd := exec.Command(binary)
	cmd.Dir = root
	for _, entry := range os.Environ() {
		if strings.HasPrefix(entry, "LISTEN_ADDR=") || strings.HasPrefix(entry, "E2E_MODE=") {
			continue
		}
		cmd.Env = append(cmd.Env, entry)
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
	var server apiServer
	select {
	case value := <-ready:
		if value.Event != "listening" {
			t.Fatalf("unexpected startup event: %q", value.Event)
		}
		host, port, err := net.SplitHostPort(value.Address)
		if err != nil || host != "127.0.0.1" || port == "0" {
			t.Fatalf("invalid address: %q", value.Address)
		}
		server.address = value.Address
	case err := <-decodeErr:
		t.Fatalf("startup output: %v", err)
	case <-done:
		t.Fatalf("server exited before ready: %v", exitErr)
	case <-time.After(10 * time.Second):
		t.Fatal("server startup timeout")
	}
	server.root = root
	server.spec = api.spec
	server.router = api.router
	server.client = &http.Client{Timeout: 5 * time.Second}
	server.cmd = cmd
	server.done = done
	t.Cleanup(func() { server.client.CloseIdleConnections() })
	return &server
}

// stop terminates the process; a restarted server holds no previous state.
func (s *apiServer) stop(t *testing.T) {
	t.Helper()
	select {
	case <-s.done:
	default:
		_ = s.cmd.Process.Kill()
		select {
		case <-s.done:
		case <-time.After(5 * time.Second):
			t.Error("server did not exit after kill")
		}
	}
}

func (s *apiServer) url(path string) string {
	return "http://" + s.address + path
}

// do performs an HTTP request; when payload is non-nil it is sent as JSON.
// Every response is checked for the JSON content type and validated against
// the generated OpenAPI contract before being returned.
func (s *apiServer) do(t *testing.T, method, path string, payload any) *http.Response {
	t.Helper()
	var body io.Reader
	if payload != nil {
		encoded, err := json.Marshal(payload)
		if err != nil {
			t.Fatalf("marshal payload: %v", err)
		}
		body = bytes.NewReader(encoded)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	request, err := http.NewRequestWithContext(ctx, method, s.url(path), body)
	if err != nil {
		t.Fatal(err)
	}
	if payload != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	response, err := s.client.Do(request)
	if err != nil {
		t.Fatalf("%s %s: %v", method, path, err)
	}
	content, err := io.ReadAll(response.Body)
	_ = response.Body.Close()
	if err != nil {
		t.Fatalf("%s %s: %v", method, path, err)
	}
	if err := validateResponse(ctx, s.spec, s.router, request, response, content); err != nil {
		t.Fatalf("%s %s violates OpenAPI: %v", method, path, err)
	}
	// The contract validator consumed the buffered content; hand a fresh reader to the caller.
	response.Body = io.NopCloser(bytes.NewReader(content))
	return response
}

func validateResponse(ctx context.Context, spec *openapi3.T, router routers.Router, request *http.Request, response *http.Response, content []byte) error {
	if response.Header.Get("Content-Type") != "application/json" {
		return fmt.Errorf("unexpected content type: %s", response.Header.Get("Content-Type"))
	}
	route, params, err := router.FindRoute(request)
	if err != nil {
		return err
	}
	response.Body = io.NopCloser(bytes.NewReader(content))
	return openapi3filter.ValidateResponse(ctx, &openapi3filter.ResponseValidationInput{
		RequestValidationInput: &openapi3filter.RequestValidationInput{Request: request, Route: route, PathParams: params},
		Status:                 response.StatusCode,
		Header:                 response.Header,
		Body:                   response.Body,
		Options:                &openapi3filter.Options{IncludeResponseStatus: true},
	})
}

func mustRead(t *testing.T, response *http.Response, target any) {
	t.Helper()
	content, err := io.ReadAll(response.Body)
	if err != nil {
		t.Fatalf("read response: %v", err)
	}
	if err := json.Unmarshal(content, target); err != nil {
		t.Fatalf("decode response (%s): %v\n%s", response.Status, err, content)
	}
}
