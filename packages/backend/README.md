# @slidex/backend

This workspace owns the entire Convex deployment: schema, functions, HTTP actions, generated API types, and Convex Auth. Run its lifecycle through the root scripts:

```bash
pnpm convex:dev
pnpm convex:deploy
```

The web app consumes generated function references through `@slidex/backend/api`; it does not contain a `convex/` directory.
