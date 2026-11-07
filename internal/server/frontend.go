package server

import (
	"io/fs"
	"net/http"
	"path"
	"strings"
)

// WithFrontend serves the client separately from the entire API namespace.
func WithFrontend(api http.Handler, files fs.FS) http.Handler {
	assets := http.FileServer(http.FS(files))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api" || strings.HasPrefix(r.URL.Path, "/api/") {
			http.StripPrefix("/api", api).ServeHTTP(w, r)
			return
		}
		if r.URL.Path == "/health" {
			api.ServeHTTP(w, r)
			return
		}
		name := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
		if name == "." {
			name = "index.html"
		}
		if info, err := fs.Stat(files, name); err == nil && !info.IsDir() {
			assets.ServeHTTP(w, r)
			return
		}
		if (r.Method == http.MethodGet || r.Method == http.MethodHead) && path.Ext(name) == "" && strings.Contains(r.Header.Get("Accept"), "text/html") {
			index, err := fs.ReadFile(files, "index.html")
			if err != nil {
				http.NotFound(w, r)
				return
			}
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			if r.Method == http.MethodGet {
				_, _ = w.Write(index)
			}
			return
		}
		http.NotFound(w, r)
	})
}
