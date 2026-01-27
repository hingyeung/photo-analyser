import { initSchema } from "../db/schema.js";
import { config } from "../config.js";
import { createApp } from "./server.js";

function main() {
  initSchema();
  const app = createApp();

  app.listen(config.WEB_PORT, () => {
    console.log(`Photo Analyser web UI running at http://localhost:${config.WEB_PORT}`);
  });
}

main();
