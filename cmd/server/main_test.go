package main

import "testing"

func TestListenAddress(t *testing.T) {
	tests := []struct {
		name    string
		env     map[string]string
		want    string
		wantErr bool
	}{
		{name: "default", want: "127.0.0.1:8080"},
		{name: "empty listen address", env: map[string]string{"LISTEN_ADDR": ""}, want: "127.0.0.1:8080"},
		{name: "ephemeral listen address", env: map[string]string{"LISTEN_ADDR": "127.0.0.1:0"}, want: "127.0.0.1:0"},
		{name: "port overrides listen address", env: map[string]string{"PORT": "10000", "LISTEN_ADDR": "127.0.0.1:8080"}, want: "0.0.0.0:10000"},
		{name: "minimum", env: map[string]string{"PORT": "1"}, want: "0.0.0.0:1"},
		{name: "maximum", env: map[string]string{"PORT": "65535"}, want: "0.0.0.0:65535"},
		{name: "leading zeros", env: map[string]string{"PORT": "08080"}, want: "0.0.0.0:8080"},
		{name: "empty port", env: map[string]string{"PORT": "", "LISTEN_ADDR": ":8080"}, wantErr: true},
		{name: "zero", env: map[string]string{"PORT": "0"}, wantErr: true},
		{name: "too large", env: map[string]string{"PORT": "65536"}, wantErr: true},
		{name: "overflow", env: map[string]string{"PORT": "999999999999999999999"}, wantErr: true},
		{name: "letters", env: map[string]string{"PORT": "http"}, wantErr: true},
		{name: "whitespace", env: map[string]string{"PORT": " 8080"}, wantErr: true},
		{name: "sign", env: map[string]string{"PORT": "+8080"}, wantErr: true},
		{name: "decimal point", env: map[string]string{"PORT": "80.0"}, wantErr: true},
		{name: "non-ascii digits", env: map[string]string{"PORT": "８０"}, wantErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := listenAddress(func(key string) (string, bool) {
				value, ok := tt.env[key]
				return value, ok
			})
			if (err != nil) != tt.wantErr || got != tt.want {
				t.Fatalf("listenAddress() = %q, %v; want %q, error=%v", got, err, tt.want, tt.wantErr)
			}
		})
	}
}
