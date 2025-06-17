import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import * as schema from "../shared/schema.sqlite";
import { requestLogger } from "./middleware/logging";
import { errorHandler, notFound } from "./middleware/errorHandler";
import apiRoutes from "./routes/api";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Enhanced logging middleware
app.use(requestLogger);

// Additional API routes
app.use('/api', apiRoutes);

(async () => {
  const server = await registerRoutes(app);

  // Enhanced error handling
  app.use(notFound);
  app.use(errorHandler);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  const host = "localhost";
  server.listen(port, host, () => {
    log(`Serving on http://localhost:${port}`);
  });
  server.on('error', (err) => {
    console.error('Server listen error:', err);
  });
})();
