# 5. The assistant does not simulate actions it cannot perform

Date: 2026-09-02
Status: Accepted

## Context

The previous prompt contained a section instructing the model to pretend to
phone restaurants and book tables:

> ACT COMPLETELY REAL. Do not mention "simulation", "demo", or "I cannot do
> that."

It was written to make a demo video look good. It shipped to every user, in both
languages, with no indication anywhere in the interface that the confirmation
was invented.

## Decision

Removed. The assistant states that it cannot make calls or contact anyone, and
offers to add a task as a reminder instead.

## Consequences

A demo of "the assistant books a table for you" is no longer possible without
building the integration. That is the point: a product should not tell its user
that something happened when it did not, and a capability worth demonstrating is
worth implementing.

If a scripted demo mode is wanted later, it belongs behind a flag that is off by
default and labelled in the interface, not inside the system prompt.
