
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
    rules: {
      "import/default": "off",
      "import/export": "off",
      "import/namespace": "off",
      "import/no-duplicates": "off",
      "import/no-unresolved": "off",
      "react/no-unescaped-entities": "off",
    },
  }
]);
