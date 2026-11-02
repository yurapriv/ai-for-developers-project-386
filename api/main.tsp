import "@typespec/http";
import "@typespec/openapi";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

@service(#{ title: "Calendar Booking API" })
namespace CalendarBooking;

model Health {
  status: "ok";
}

@get
@route("/health")
@operationId("getHealth")
op health(): {
  @statusCode statusCode: 200;
  @body body: Health;
};
