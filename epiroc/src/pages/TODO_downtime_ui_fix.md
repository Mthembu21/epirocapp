# TODO: Fix TechnicianPortal JSX + finalize downtime UI wiring

## Done
- Wired backend pause/resume endpoints into `epirocapp/src/api/apiClient.js` as `base44.entities.Downtime.*`
- Wired TechnicianPortal downtime “Save Downtime” to `base44.entities.Downtime.pauseJob(...)`

## Blocker
- `epirocapp/src/pages/TechnicianPortal.jsx` is currently not compiling due to duplicated/mismatched JSX tags in the `Tabs` section (errors around `TabsContent value="jobs"`, and tag mismatches for `Tabs`, `main`, `div`).

## Next steps
1. Clean up duplicated `TabsContent value="jobs"` block (there appears to be an extra duplicate opening tag).
2. Re-run `npm run build` to confirm compilation.
3. After build passes, add/verify downtime Resume wiring (`onResume`) if needed.

## Verification
- Run: `cd epirocapp/epiroc && npm run build`
- Confirm in browser that pause/resume buttons call the backend without console errors.

