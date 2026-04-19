# Deferred Items — Phase 01

## From plan 01-03

- **ESLint v9 config missing** (pre-existing): `npm run lint` fails immediately because no `eslint.config.js` exists and ESLint v9 no longer supports legacy `.eslintrc.*` files. This is not caused by task 01-03 changes and affects the entire repo. Out-of-scope per deviation rules. Recommend a follow-up plan to add a flat-config `eslint.config.js`.
