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

// Тип встречи: предложение встречи с названием, описанием и длительностью.
// Id назначает приложение; клиент не передаёт его. Порядок каталога — порядок создания.
model MeetingType {
  id: int64;
  name: string;
  description: string;
  durationMinutes: int64;
}

// Данные для создания типа встречи. Название и описание проверяются после
// удаления пробелов по краям: 1–100 и 1–2000 символов соответственно.
// Длительность — целое число минут от 1 до 540 включительно (не обязана быть кратна 30).
model MeetingTypeInput {
  name: string;
  description: string;
  durationMinutes: int64;
}

// Единый формат ошибок приложения. Сообщение понятно пользователю,
// fields перечисляет ошибки отдельных полей формы (пусто, если ошибки не привязаны к полям).
model Problem {
  message: string;
  fields: FieldProblem[];
}

model FieldProblem {
  field: string;
  message: string;
}

@post
@route("/meeting-types")
@operationId("createMeetingType")
op createMeetingType(@body body: MeetingTypeInput): {
  @statusCode statusCode: 201;
  @body body: MeetingType;
} | {
  @statusCode statusCode: 422;
  @body body: Problem;
};

@get
@route("/meeting-types")
@operationId("listMeetingTypes")
op listMeetingTypes(): {
  @statusCode statusCode: 200;
  @body body: MeetingType[];
};
