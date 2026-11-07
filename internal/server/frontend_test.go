package server_test

import (
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/yurapriv/ai-for-developers-project-386/internal/server"
)

func TestFrontendAndAPIStaySeparate(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte("<html>app</html>"), 0o600); err != nil {
		t.Fatal(err)
	}
	api, err := server.NewHandler()
	if err != nil {
		t.Fatal(err)
	}
	handler := server.WithFrontend(api, os.DirFS(dir))
	for _, tc := range []struct {
		method, path, accept string
		status               int
		html                 bool
	}{
		{"GET", "/booking", "text/html", 200, true},
		{"GET", "/unknown", "text/html", 200, true},
		{"GET", "/assets/missing.js", "text/html", 404, false},
		{"GET", "/api/missing", "text/html", 404, false},
		{"POST", "/api/meeting-types", "text/html", 422, false},
		{"GET", "/api/meeting-types", "application/json", 200, false},
	} {
		t.Run(tc.method+tc.path, func(t *testing.T) {
			req := httptest.NewRequest(tc.method, tc.path, nil)
			req.Header.Set("Accept", tc.accept)
			res := httptest.NewRecorder()
			handler.ServeHTTP(res, req)
			if res.Code != tc.status || strings.Contains(res.Header().Get("Content-Type"), "text/html") != tc.html {
				t.Fatalf("status=%d content-type=%q body=%q", res.Code, res.Header().Get("Content-Type"), res.Body.String())
			}
		})
	}
}
