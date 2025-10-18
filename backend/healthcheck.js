#!/usr/bin/env node

/**
 * Health check script for Docker container
 * Checks if the application is responding and healthy
 */

const http = require("http");

const options = {
  hostname: "localhost",
  port: process.env.PORT || 3000,
  path: "/health",
  method: "GET",
  timeout: 5000,
  headers: {
    "User-Agent": "Docker-Health-Check",
  },
};

const healthCheck = () => {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        if (res.statusCode === 200) {
          try {
            const health = JSON.parse(data);
            if (health.status === "ok") {
              console.log("Health check passed:", health);
              resolve(health);
            } else {
              console.error("Health check failed:", health);
              reject(new Error(`Health check failed: ${health.status}`));
            }
          } catch (error) {
            console.error("Invalid health check response:", data);
            reject(new Error("Invalid health check response"));
          }
        } else {
          console.error(`Health check failed with status: ${res.statusCode}`);
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });

    req.on("error", (error) => {
      console.error("Health check request failed:", error.message);
      reject(error);
    });

    req.on("timeout", () => {
      req.destroy();
      console.error("Health check timed out");
      reject(new Error("Health check timeout"));
    });

    req.end();
  });
};

// Run health check
healthCheck()
  .then(() => {
    console.log("✅ Health check successful");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Health check failed:", error.message);
    process.exit(1);
  });
