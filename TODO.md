# TODO

## Content

- [ ] Add new cheat sheets (currently 21 across 2 categories)

## Code Quality

- [ ] Add cache for SVG icons in `TechIcon` component to avoid repeated fetches
- [ ] Refactor `home-client.tsx` (~620 lines) into smaller modules:
  - [ ] Extract hex layout logic to `src/lib/hex-layout.ts`
  - [ ] Extract help modal to `src/components/home-help-modal.tsx`
  - [ ] Extract info modal to `src/components/home-info-modal.tsx`
- [ ] Centralize magic constants (hex ratios, breakpoints) in `src/lib/constants.ts`
- [ ] Add focus trap to modals for better keyboard accessibility

## Testing

- [ ] Write unit tests for hex layout functions (`buildHexRows`, `getHexMetrics`, etc.)
- [ ] Write unit tests for navigation logic (`getVerticalTarget`, `getHorizontalTarget`)
- [ ] Add integration tests for keyboard navigation

## UX

- [ ] Add a user-configurable keybinding system so shortcuts (navigate: hjkl/arrows, copy: y, example: i) can be remapped via a settings panel

## Deployment

- [ ] Add CI/CD configuration (Vercel, GitHub Actions)
- [ ] Add lint check to CI pipeline
