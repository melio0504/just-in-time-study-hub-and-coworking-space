# Just In Time Study Hub and Coworking Space's Contribution Guide

This guide explains how to set up your work, name branches, use git, and open a pull request on GitHub.

## Before You Start

- Make sure you have Node.js 20.9 or newer installed.
- Install dependencies with `npm install`.
- Run the app locally with `npm run dev` before making changes.
- Review the README to understand the app structure and available routes.

## Branch Naming

Use short, descriptive branch names that explain the purpose of the change.

Recommended format:

- `feature/add-pricing-section`
- `fix/header-mobile-spacing`
- `docs/update-contributing-guide`
- `refactor/seating-plan-component`
- `chore/update-dependencies`

Keep names lowercase, use hyphens, and avoid long or unclear branch names.

## Git Workflow

1. Start from the latest `main` branch.
2. Create a new branch for your work.
3. Make your changes in small, focused commits.
4. Test and lint before pushing.
5. Push the branch to GitHub.
6. Open a pull request.

Example commands:

```bash
git checkout main
git pull origin main
git checkout -b feature/add-new-section
```

After making changes:

```bash
git status
git add .
git commit -m "feat: add new section"
git push origin feature/add-new-section
```

## Commit Messages

Write clear commit messages that describe the change.

Common prefixes:

- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation updates
- `style:` for formatting or visual-only changes
- `refactor:` for code restructuring without behavior changes
- `test:` for tests
- `chore:` for maintenance tasks

Examples:

- `feat: add homepage testimonial section`
- `fix: correct mobile navigation spacing`
- `docs: add contributing guidelines`

## Local Checks

Before opening a pull request, run the project checks that apply to your change:

```bash
npm run lint
npm run build
```

If your change affects the UI, also verify it in the browser with `npm run dev`.

## Opening a Pull Request on GitHub

1. Push your branch to GitHub.
2. Open the repository page on GitHub.
3. Click Compare & pull request, or open the Pull requests tab and create a new PR.
4. Choose the correct base branch, usually `main`.
5. Add a clear title and a short description of what changed and why.
6. Include screenshots or screen recordings if the change affects the UI.
7. Mention any testing you ran, such as linting or building.
8. Request review if the repository uses reviewers.
9. Respond to feedback with follow-up commits pushed to the same branch.

## Pull Request Checklist

Before submitting, confirm the following:

- The branch name is clear and matches the type of work.
- The code is lint-free and builds successfully.
- The change is scoped to the intended task.
- Any new UI behavior has been tested in the browser.
- The PR description explains the change in plain language.
- Screenshots are included when useful.

## Project Notes

- This app uses the Next.js App Router.
- Reusable UI components live in `app/components/`.
- Static images are stored in `public/images/`.
- Keep changes consistent with the existing design and component patterns.

## Need Help?

If something is unclear, open an issue or leave a note in your pull request so the next contributor can follow the context.
