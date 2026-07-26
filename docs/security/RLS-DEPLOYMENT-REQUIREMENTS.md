# RLS deployment requirements

The application database role must not be a PostgreSQL superuser and must not
have the `BYPASSRLS` attribute. RLS policies do not constrain either privilege.

Database migrations may use a separate privileged deployment role. The runtime
`DATABASE_URL` for the API must use the non-bypass application role and receive
only the table privileges it needs.

The local `postgres` superuser is suitable for migration administration and
test setup only; it is not a valid production application role once RLS is
enabled.
