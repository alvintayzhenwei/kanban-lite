import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import globals from 'globals';
export default defineConfig(
  {ignores:['dist/**','node_modules/**','.superpowers/**']},
  {files:['**/*.ts'],extends:[js.configs.recommended,tseslint.configs.recommended],languageOptions:{globals:globals.node},rules:{'@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_'}]}},
  {files:['public/**/*.js'],extends:[js.configs.recommended],languageOptions:{globals:globals.browser}},
  {files:['scripts/**/*.js'],extends:[js.configs.recommended],languageOptions:{globals:globals.node}}
);
