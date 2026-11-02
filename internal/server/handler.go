package server

import (
	"context"
	"net/http"

	middleware "github.com/oapi-codegen/nethttp-middleware"
	"github.com/yurapriv/ai-for-developers-project-386/internal/api"
)

type operations struct{}

var _ api.StrictServerInterface = operations{}

func (operations) GetHealth(_ context.Context, _ api.GetHealthRequestObject) (api.GetHealthResponseObject, error) {
	return api.GetHealth200JSONResponse{Status: api.Ok}, nil
}

func NewHandler() (http.Handler, error) {
	spec, err := api.GetSpec()
	if err != nil {
		return nil, err
	}
	if err := spec.Validate(context.Background()); err != nil {
		return nil, err
	}
	strict := api.NewStrictHandler(operations{}, nil)
	handler := api.HandlerFromMux(strict, http.NewServeMux())
	return middleware.OapiRequestValidator(spec)(handler), nil
}
