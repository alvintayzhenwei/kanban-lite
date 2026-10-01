import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'tests/browser',workers:1,timeout:15000,use:{browserName:'chromium',trace:'retain-on-failure',screenshot:'only-on-failure'}});
