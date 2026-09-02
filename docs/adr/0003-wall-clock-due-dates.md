# 3. Due dates are wall-clock, not instants

Date: 2026-09-02
Status: Accepted

## Context

The client sent `new Date().toISOString()` as the current time and the model
returned dates as ISO strings. At 23:30 in São Paulo the UTC instant is already
the next day, so "add it for tomorrow" resolved two days out.

## Decision

A due date is `YYYY-MM-DD` for an all-day task or `YYYY-MM-DDTHH:mm` when a time
was given. Never a UTC instant, never an offset.

The request carries the caller's IANA timezone, validated before it reaches
`Intl` (it is untrusted input, and `Intl` throws on anything unexpected). The
prompt states the local weekday, date and zone, so the model resolves relative
dates against the user's calendar rather than against UTC.

Rendering builds a local `Date` from the parts rather than parsing the string,
so a due date shows the same day everywhere. Calendar export sends a naive
`dateTime` plus a `timeZone`, which is what Google Calendar expects for a
wall-clock appointment.

## Consequences

Recurrence and cross-timezone travel are not modelled. A task written in one
zone keeps its wall-clock time when the user moves, which matches how people
talk about appointments and is the behaviour a task list should have.
