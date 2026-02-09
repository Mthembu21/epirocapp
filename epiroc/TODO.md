# ESLint Errors Fix Plan

## vite.config.js
- [ ] Fix '__dirname' not defined: use import.meta.url

## components/dashboard/MonthlyArchiveManager.jsx
- [ ] Remove unused import 'differenceInBusinessDays'
- [ ] Fix setState in useEffect: use useMemo for workingDaysCount

## components/dashboard/PerformanceCharts.jsx
- [ ] Remove unused 'name' parameter

## components/jobs/JobAllocationModal.jsx
- [ ] Remove unused 'existingJobs' parameter

## components/jobs/JobList.jsx
- [ ] Remove unused 'format' and 'parseISO' imports

## components/timesheet/ExportButton.jsx
- [ ] Remove unused 'parseISO' import and 'technicians' parameter

## components/timesheet/TimesheetForm.jsx
- [ ] Move calculateHours function before useEffect
- [ ] Add calculateHours to useEffect dependencies

## components/ui/badge.jsx
- [ ] Separate non-component exports to avoid fast refresh error

## components/ui/button.jsx
- [ ] Separate non-component exports

## components/ui/form.jsx
- [ ] Separate non-component exports

## components/ui/navigation-menu.jsx
- [ ] Separate non-component exports

## components/ui/sidebar.jsx
- [ ] Fix Math.random in render: move to useMemo or constant
- [ ] Separate non-component exports

## components/ui/toggle.jsx
- [ ] Separate non-component exports

## pages/BackendCodeDocumentation.jsx
- [ ] Remove unused 'title' parameter

## pages/TechnicianPortal.jsx
- [ ] Move calculateHours function before useEffect
- [ ] Add calculateHours to useEffect dependencies
