import { defineConfig, devices } from "@playwright/test";
const apiPort = process.env.TRAINFUEL_API_PORT || "8000";
const webPort = process.env.TRAINFUEL_WEB_PORT || "5173";
const pythonCommand = process.env.TRAINFUEL_PYTHON || "../backend/.venv/bin/python";

export default defineConfig({
  testDir: "./tests",
  workers: 1,
  timeout: 45000,
  use: { baseURL: `http://127.0.0.1:${webPort}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command: `${pythonCommand} ../backend/manage.py runserver 127.0.0.1:${apiPort} --noreload`,
      url: `http://127.0.0.1:${apiPort}/api/health/`,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `npm run build && npm run preview -- --port ${webPort} --strictPort`,
      url: `http://127.0.0.1:${webPort}`,
      env: { TRAINFUEL_API_TARGET: `http://127.0.0.1:${apiPort}` },
      reuseExistingServer: !process.env.CI,
    },
  ],
});
