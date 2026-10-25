# Repository guidance

- This is a Hexlet calendar-booking service exercise, currently only a scaffold. There is no application code, selected toolchain, dependency manifest, or local build/test/lint command yet; do not assume a framework or package manager.
- `README.md` links the expected-behavior demo and course. Its stack, installation, and usage sections are placeholders, not working setup instructions.

## Hexlet checks

- Do not edit, delete, or rename `.github/workflows/hexlet-check.yml`, and do not rename the repository. These restrictions come from the workflow header and `.github/workflows/README.md`.
- The workflow runs on branch and tag pushes, uses `hexlet/project-action@release` on Ubuntu, and requires the GitHub Actions secret `HEXLET_ID`. It exposes no local test command.
- `.github/workflows/README.md` says automatic tests become available after all project tasks are completed in Hexlet; a subsequent pushed commit triggers the workflow.
