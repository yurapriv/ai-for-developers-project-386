package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/yurapriv/ai-for-developers-project-386/internal/server"
)

func main() {
	if err := run(); err != nil {
		log.Print(err)
		os.Exit(1)
	}
}

func run() error {
	clock := time.Now
	if os.Getenv("E2E_MODE") == "1" && os.Getenv("E2E_FIXED_NOW") != "" {
		fixed, err := time.Parse(time.RFC3339Nano, os.Getenv("E2E_FIXED_NOW"))
		if err != nil {
			return fmt.Errorf("invalid E2E_FIXED_NOW: %w", err)
		}
		clock = func() time.Time { return fixed }
	}
	handler, err := server.NewHandlerWithClock(clock)
	if err != nil {
		return fmt.Errorf("initialize API: %w", err)
	}
	address := os.Getenv("LISTEN_ADDR")
	if address == "" {
		address = "127.0.0.1:8080"
	}
	listener, err := net.Listen("tcp", address)
	if err != nil {
		return fmt.Errorf("listen: %w", err)
	}
	defer func() { _ = listener.Close() }()

	srv := &http.Server{
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := json.NewEncoder(os.Stdout).Encode(struct {
		Event   string `json:"event"`
		Address string `json:"address"`
	}{"listening", listener.Addr().String()}); err != nil {
		return fmt.Errorf("report address: %w", err)
	}
	result := make(chan error, 1)
	go func() { result <- srv.Serve(listener) }()
	select {
	case err := <-result:
		if !errors.Is(err, http.ErrServerClosed) {
			return err
		}
		return nil
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		return srv.Shutdown(shutdownCtx)
	}
}
