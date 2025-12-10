// This file is the CLI entrypoint for running migrations.

import { migrator } from "./src/umzug.js";

// This allows us to run migrations from the command line
(async () => {
  await migrator.runAsCLI();
  // umzug doesn't terminate automatically, so we do it here
  process.exit(0);
})();
