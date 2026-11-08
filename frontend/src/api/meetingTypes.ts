// Typed access to the generated meeting type SDK. Pages import from here so
// the generated client stays encapsulated behind domain-level outcomes.
import type { FieldProblem, MeetingType, MeetingTypeInput, Problem } from './generated';
import { createMeetingType as createMeetingTypeRequest, listMeetingTypes } from './generated';

export type { FieldProblem, MeetingType } from './generated';

export const listLoadMessage = 'Не удалось загрузить каталог типов встреч';
export const createFailureMessage = 'Не удалось создать тип встречи';

export type MeetingTypeListResult =
  | { ok: true; meetingTypes: MeetingType[] }
  | { ok: false; message: string };

export type MeetingTypeCreateResult =
  | { ok: true; meetingType: MeetingType }
  | { ok: false; kind: 'invalid'; message: string; fields: FieldProblem[] }
  | { ok: false; kind: 'failure'; message: string };

export async function loadMeetingTypes(): Promise<MeetingTypeListResult> {
  const result = await listMeetingTypes();
  if (result.data !== undefined) {
    return { ok: true, meetingTypes: result.data };
  }
  return { ok: false, message: listLoadMessage };
}

export async function createMeetingType(input: MeetingTypeInput): Promise<MeetingTypeCreateResult> {
  const result = await createMeetingTypeRequest({ body: input });
  if (result.data !== undefined) {
    return { ok: true, meetingType: result.data };
  }
  if (result.response !== undefined && result.response.status === 422 && isProblem(result.error)) {
    return {
      ok: false,
      kind: 'invalid',
      message: result.error.message,
      fields: result.error.fields,
    };
  }
  return { ok: false, kind: 'failure', message: createFailureMessage };
}

function isProblem(value: unknown): value is Problem {
  if (typeof value !== 'object' || value === null) return false;
  const problem = value as Partial<Problem>;
  return typeof problem.message === 'string' && Array.isArray(problem.fields);
}

export function durationText(durationMinutes: number): string {
  const lastOne = durationMinutes % 10;
  const lastTwo = durationMinutes % 100;
  if (lastOne === 1 && lastTwo !== 11) return `${durationMinutes} минута`;
  if (lastOne >= 2 && lastOne <= 4 && (lastTwo < 12 || lastTwo > 14))
    return `${durationMinutes} минуты`;
  return `${durationMinutes} минут`;
}
