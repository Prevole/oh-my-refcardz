---
description: Create a personalized cheatsheet based on your actual usage
---

Create a cheatsheet for: $ARGUMENTS

## Research Phase

1. **Local shell history** — Search both:
   - Atuin database (~/.local/share/atuin/history.db) for commands matching the topic
   - ~/.zsh_history for additional patterns

2. **Personal configs** — Check:
   - Chezmoi source: ~/.local/share/chezmoi/
   - Applied configs: ~/.zshrc, ~/.aliases, any relevant dotfiles
   - Personal oh-my-zsh plugin with custom aliases/functions

3. **Extrapolate** — Based on what you find:
   - Identify patterns in how the user works with this tool
   - Propose related commands they might not know but would likely use

## Icon & Color

4. **Icon** — Search the web for an official SVG icon for this technology. Propose options and iterate with the user until satisfied. Download to `/public/icons/`.
   - The final SVG must be monochrome and tintable by the app theme: use `fill="currentColor"` and/or `stroke="currentColor"` instead of hardcoded brand colors.
   - If the official asset is multicolor or includes a wordmark, simplify it to a compact icon that still reads well at small size while remaining theme-tintable.

5. **Color** — Propose a hex color matching the tech's branding.

## Content Generation

6. **Structure** — Based on research, propose sections and cards that reflect:
   - Commands the user actually uses (from history)
   - Personal aliases and shortcuts
   - Useful commands they should know

7. **Review** — Present the proposed structure for validation before generating.

8. **Generate** — Create the YAML file in content/cheatsheets/<category>/.

Always ask which category (Tooling, Languages, etc.) before generating.
