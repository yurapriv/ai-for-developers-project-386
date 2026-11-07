import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router';
import { createMeetingType, loadMeetingTypes } from '../api/meetingTypes';
import type { FieldProblem, MeetingType } from '../api/meetingTypes';
import { MeetingTypeCatalog } from './MeetingTypeCatalog';

type FormFields = {
  name: string;
  description: string;
  durationMinutes: string;
};

type FieldErrors = Partial<Record<'name' | 'description' | 'durationMinutes', string>>;

type CatalogState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; meetingTypes: MeetingType[] };

const emptyForm: FormFields = { name: '', description: '', durationMinutes: '' };

function isFormFieldKey(field: string): field is keyof FieldErrors {
  return field === 'name' || field === 'description' || field === 'durationMinutes';
}

function validateForm(form: FormFields): FieldErrors {
  const fieldErrors: FieldErrors = {};
  const name = form.name.trim();
  if (name === '') {
    fieldErrors.name = 'Укажите название';
  } else if ([...name].length > 100) {
    fieldErrors.name = 'Название должно быть от 1 до 100 символов';
  }
  const description = form.description.trim();
  if (description === '') {
    fieldErrors.description = 'Укажите описание';
  } else if ([...description].length > 2000) {
    fieldErrors.description = 'Описание должно быть от 1 до 2000 символов';
  }
  const durationMinutes = Number(form.durationMinutes);
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 540) {
    fieldErrors.durationMinutes = 'Длительность должна быть целым числом от 1 до 540 минут';
  }
  return fieldErrors;
}

function fieldProblemsToErrors(fields: FieldProblem[]): FieldErrors {
  const fieldErrors: FieldErrors = {};
  for (const problem of fields) {
    if (isFormFieldKey(problem.field)) {
      fieldErrors[problem.field] = problem.message;
    }
  }
  return fieldErrors;
}

export function AdminPage() {
  const [form, setForm] = useState<FormFields>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdNotice, setCreatedNotice] = useState(false);
  const [catalogState, setCatalogState] = useState<CatalogState>({ kind: 'loading' });
  const inFlight = useRef(false);

  const loadCatalog = useCallback(async () => {
    const result = await loadMeetingTypes();
    if (result.ok) {
      setCatalogState({ kind: 'ready', meetingTypes: result.meetingTypes });
    } else {
      setCatalogState({ kind: 'error' });
    }
  }, []);

  useEffect(() => {
    let subscribed = true;
    void loadMeetingTypes().then((result) => {
      if (subscribed) {
        if (result.ok) {
          setCatalogState({ kind: 'ready', meetingTypes: result.meetingTypes });
        } else {
          setCatalogState({ kind: 'error' });
        }
      }
    });
    return () => {
      subscribed = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setCreatedNotice(false);
    if (inFlight.current) {
      return;
    }
    const validationErrors = validateForm(form);
    setFieldErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }
    inFlight.current = true;
    setCreating(true);
    try {
      const result = await createMeetingType({
        name: form.name,
        description: form.description,
        durationMinutes: Number(form.durationMinutes),
      });
      if (result.ok) {
        setForm(emptyForm);
        setFieldErrors({});
        setFormError('');
        setCreatedNotice(true);
        await loadCatalog();
      } else if (result.kind === 'invalid') {
        const serverErrors = fieldProblemsToErrors(result.fields);
        setFieldErrors(serverErrors);
        setFormError(Object.keys(serverErrors).length === 0 ? result.message : '');
      } else {
        setFormError(result.message);
      }
    } finally {
      inFlight.current = false;
      setCreating(false);
    }
  }

  return (
    <main>
      <h1>Админка</h1>
      <h2>Создание типа встречи</h2>
      {createdNotice && <output>Тип встречи создан</output>}
      <form className="meeting-type-form" noValidate onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="meeting-type-name">Название</label>
          <input
            id="meeting-type-name"
            name="name"
            type="text"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            aria-invalid={fieldErrors.name !== undefined}
            aria-describedby={
              fieldErrors.name !== undefined ? 'meeting-type-name-error' : undefined
            }
          />
          {fieldErrors.name && (
            <p className="field-error" id="meeting-type-name-error" role="alert">
              {fieldErrors.name}
            </p>
          )}
        </div>
        <div className="form-field">
          <label htmlFor="meeting-type-description">Описание</label>
          <textarea
            id="meeting-type-description"
            name="description"
            rows={3}
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            aria-invalid={fieldErrors.description !== undefined}
            aria-describedby={
              fieldErrors.description !== undefined ? 'meeting-type-description-error' : undefined
            }
          />
          {fieldErrors.description && (
            <p className="field-error" id="meeting-type-description-error" role="alert">
              {fieldErrors.description}
            </p>
          )}
        </div>
        <div className="form-field">
          <label htmlFor="meeting-type-duration">Длительность</label>
          <input
            id="meeting-type-duration"
            name="durationMinutes"
            type="number"
            inputMode="numeric"
            min={1}
            max={540}
            step={1}
            value={form.durationMinutes}
            onChange={(event) => setForm({ ...form, durationMinutes: event.target.value })}
            aria-invalid={fieldErrors.durationMinutes !== undefined}
            aria-describedby={
              fieldErrors.durationMinutes !== undefined
                ? 'meeting-type-duration-error'
                : 'meeting-type-duration-hint'
            }
          />
          <p className="form-hint" id="meeting-type-duration-hint">
            Минуты, целое число от 1 до 540
          </p>
          {fieldErrors.durationMinutes && (
            <p className="field-error" id="meeting-type-duration-error" role="alert">
              {fieldErrors.durationMinutes}
            </p>
          )}
        </div>
        {formError && (
          <p className="field-error" role="alert">
            {formError}
          </p>
        )}
        <button disabled={creating} type="submit">
          Создать тип встречи
        </button>
      </form>
      <h2>Типы встреч</h2>
      {catalogState.kind === 'loading' && <output>Загрузка типов встреч…</output>}
      {catalogState.kind === 'error' && (
        <div className="failure">
          <p role="alert">Не удалось загрузить типы встреч</p>
          <button
            type="button"
            onClick={() => {
              setCatalogState({ kind: 'loading' });
              void loadCatalog();
            }}
          >
            Повторить
          </button>
        </div>
      )}
      {catalogState.kind === 'ready' &&
        (catalogState.meetingTypes.length === 0 ? (
          <p>Пока нет ни одного типа встречи</p>
        ) : (
          <MeetingTypeCatalog meetingTypes={catalogState.meetingTypes} />
        ))}
      <Link to="/">На главную</Link>
    </main>
  );
}
