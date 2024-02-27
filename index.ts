import Fastify from "fastify";
import next from "next";
import cluster from "cluster";
import * as os from "os";

// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-member-access
require("dotenv").config();

// Get the port from the environment, or default to 3000
const port = parseInt(process.env.PORT ?? "3000", 10) || 3000;
const host = process.env.HOST ?? "localhost";

// Set the dev flag based on the environment
const dev = process.env.NODE_ENV !== "production";

// Create the Next.js app
const app = next({ dev });
const handle = app.getRequestHandler();

// Get the number of CPU cores to use
const numCPUs = process.env.MAX_CORE
  ? parseInt(process.env.MAX_CORE ?? "2", 10)
  : os.cpus().length;

async function bootstrap() {
  if (cluster.isPrimary) console.log("Starting server on port", port);
  void app.prepare().then(async () => {
    const fastify = Fastify({
      logger: true,
    });

    // Catch all routes and handle them with Next.js
    fastify.all("*", async function handler(request, reply) {
      return await handle(request.raw, reply.raw);
    });

    // Run the server!
    try {
      if (cluster.isPrimary) console.log("Listening on port", port);
      // @ts-expect-error - PhusionPassenger is defined by phusion passenger (if it's being used)
      if (typeof PhusionPassenger !== "undefined")
        // @ts-expect-error - passenger is defined by phusion passenger (if it's being used)
        await fastify.listen({ port: "passenger", host: "127.0.0.1" });
      else await fastify.listen({ port, host }).catch(() => null);
    } catch (err) {
      fastify.log.error(err);
      process.exit(1);
    }
  });
}

// multithreading with nodejs
if (cluster.isPrimary) {
  console.log(`Number of CPU cores used: ${numCPUs}`);
  console.log(`Master server started on ${process.pid}`);
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  cluster.on("exit", (worker) => {
    console.log(`Worker ${worker.process.pid} died. Restarting`);
    cluster.fork();
  });
} else {
  console.log(`Cluster server started on ${process.pid}`);
  bootstrap().catch(() => null);
}
