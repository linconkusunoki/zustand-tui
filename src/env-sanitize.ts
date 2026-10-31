// If running in an interactive terminal (TTY), prevent project-local .env variables
// (e.g. CI_COMMIT_SHORT_SHA from GitLab CI in projects like camperdays-nextjs)
// from causing Ink / ci-info to disable interactive rendering and suppress output.
if (process.stdout?.isTTY) {
  delete process.env.CI;
  delete process.env.CONTINUOUS_INTEGRATION;
  for (const key of Object.keys(process.env)) {
    if (
      key.startsWith('CI_') ||
      key.startsWith('GITLAB_CI') ||
      key.startsWith('GITHUB_ACTION')
    ) {
      delete process.env[key];
    }
  }
}
