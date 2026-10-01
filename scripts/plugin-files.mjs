export const adapterFiles = [
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "src/client.ts",
  "src/tools.ts",
  "src/stdio.ts",
  "dist/client.js",
  "dist/client.d.ts",
  "dist/tools.js",
  "dist/tools.d.ts",
  "dist/stdio.js",
  "dist/stdio.d.ts",
];
export function pluginFiles(host) {
  return [
    "plugin.json",
    "mcp.json",
    ".mcp.json",
    "SETUP.md",
    `.${host}-plugin/plugin.json`,
    "skills/kanban-workflow/SKILL.md",
    ...adapterFiles.map((file) => `adapter/${file}`),
  ];
}
