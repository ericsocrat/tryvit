// TypeScript 7 does not expose the compiler API used by typescript-eslint yet.
// Keep that API isolated to ESLint while builds and type checks use TypeScript 7.
const Module = require("module");

const resolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveTypeScript6(
  request,
  parent,
  isMain,
  options,
) {
  if (request === "typescript") {
    return resolveFilename.call(
      this,
      "@typescript/typescript6",
      parent,
      isMain,
      options,
    );
  }

  return resolveFilename.call(this, request, parent, isMain, options);
};
