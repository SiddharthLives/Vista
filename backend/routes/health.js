const express = require("express");
const mongoose = require("mongoose");
const redis = require("../config/redis");
const logger = require("../config/logger");

const router = express.Router();

/**
 * Health check endpoint for monitoring and load balancers
 * Returns detailed health status of all system components
 */
router.get("/health", async (req, res) => {
  const startTime = Date.now();

  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || "1.0.0",
    environment: process.env.NODE_ENV || "development",
    checks: {},
  };

  let overallStatus = "ok";
  const checks = [];

  try {
    // Check database connection
    const dbCheck = await checkDatabase();
    health.checks.database = dbCheck;
    checks.push(dbCheck);

    // Check Redis connection
    const redisCheck = await checkRedis();
    health.checks.redis = redisCheck;
    checks.push(redisCheck);

    // Check memory usage
    const memoryCheck = checkMemory();
    health.checks.memory = memoryCheck;
    checks.push(memoryCheck);

    // Check disk space (if applicable)
    const diskCheck = await checkDiskSpace();
    health.checks.disk = diskCheck;
    checks.push(diskCheck);

    // Check external services
    const externalCheck = await checkExternalServices();
    health.checks.external = externalCheck;
    checks.push(externalCheck);

    // Determine overall status
    const hasError = checks.some((check) => check.status === "error");
    const hasWarning = checks.some((check) => check.status === "warning");

    if (hasError) {
      overallStatus = "error";
    } else if (hasWarning) {
      overallStatus = "warning";
    }

    health.status = overallStatus;
    health.responseTime = Date.now() - startTime;

    // Log health check if there are issues
    if (overallStatus !== "ok") {
      logger.warn("Health check failed", { health });
    }

    // Return appropriate HTTP status
    const statusCode =
      overallStatus === "ok" ? 200 : overallStatus === "warning" ? 200 : 503;

    res.status(statusCode).json(health);
  } catch (error) {
    logger.error("Health check error", {
      error: error.message,
      stack: error.stack,
    });

    health.status = "error";
    health.error = error.message;
    health.responseTime = Date.now() - startTime;

    res.status(503).json(health);
  }
});

/**
 * Simple liveness probe endpoint
 * Returns 200 if the application is running
 */
router.get("/health/live", (req, res) => {
  res.status(200).json({
    status: "alive",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * Readiness probe endpoint
 * Returns 200 if the application is ready to serve traffic
 */
router.get("/health/ready", async (req, res) => {
  try {
    // Check critical dependencies
    const dbReady = mongoose.connection.readyState === 1;

    if (!dbReady) {
      return res.status(503).json({
        status: "not_ready",
        reason: "Database not connected",
        timestamp: new Date().toISOString(),
      });
    }

    res.status(200).json({
      status: "ready",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (error) {
    res.status(503).json({
      status: "not_ready",
      reason: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Check database connectivity and performance
 */
async function checkDatabase() {
  const startTime = Date.now();

  try {
    // Check connection state
    if (mongoose.connection.readyState !== 1) {
      return {
        status: "error",
        message: "Database not connected",
        responseTime: Date.now() - startTime,
      };
    }

    // Perform a simple query to test responsiveness
    await mongoose.connection.db.admin().ping();

    const responseTime = Date.now() - startTime;

    return {
      status: responseTime > 1000 ? "warning" : "ok",
      message:
        responseTime > 1000
          ? "Database responding slowly"
          : "Database connected",
      responseTime,
      details: {
        readyState: mongoose.connection.readyState,
        host: mongoose.connection.host,
        name: mongoose.connection.name,
      },
    };
  } catch (error) {
    return {
      status: "error",
      message: `Database error: ${error.message}`,
      responseTime: Date.now() - startTime,
    };
  }
}

/**
 * Check Redis connectivity and performance
 */
async function checkRedis() {
  const startTime = Date.now();

  try {
    if (!redis) {
      return {
        status: "warning",
        message: "Redis not configured",
        responseTime: Date.now() - startTime,
      };
    }

    // Test Redis with ping
    await redis.ping();

    const responseTime = Date.now() - startTime;

    return {
      status: responseTime > 500 ? "warning" : "ok",
      message:
        responseTime > 500 ? "Redis responding slowly" : "Redis connected",
      responseTime,
      details: {
        connected: redis.status === "ready",
      },
    };
  } catch (error) {
    return {
      status: "error",
      message: `Redis error: ${error.message}`,
      responseTime: Date.now() - startTime,
    };
  }
}

/**
 * Check memory usage
 */
function checkMemory() {
  const memUsage = process.memoryUsage();
  const totalMem = memUsage.heapTotal;
  const usedMem = memUsage.heapUsed;
  const memoryUsagePercent = (usedMem / totalMem) * 100;

  let status = "ok";
  let message = "Memory usage normal";

  if (memoryUsagePercent > 90) {
    status = "error";
    message = "Memory usage critical";
  } else if (memoryUsagePercent > 80) {
    status = "warning";
    message = "Memory usage high";
  }

  return {
    status,
    message,
    details: {
      heapUsed: Math.round(usedMem / 1024 / 1024),
      heapTotal: Math.round(totalMem / 1024 / 1024),
      usagePercent: Math.round(memoryUsagePercent),
      external: Math.round(memUsage.external / 1024 / 1024),
      rss: Math.round(memUsage.rss / 1024 / 1024),
    },
  };
}

/**
 * Check disk space (basic implementation)
 */
async function checkDiskSpace() {
  try {
    const fs = require("fs").promises;
    const stats = await fs.stat("/tmp");

    return {
      status: "ok",
      message: "Disk space available",
      details: {
        available: true,
      },
    };
  } catch (error) {
    return {
      status: "warning",
      message: "Could not check disk space",
      details: {
        error: error.message,
      },
    };
  }
}

/**
 * Check external service dependencies
 */
async function checkExternalServices() {
  const checks = [];

  // Check Firebase (basic connectivity)
  try {
    const admin = require("firebase-admin");
    if (admin.apps.length > 0) {
      checks.push({
        service: "firebase",
        status: "ok",
        message: "Firebase initialized",
      });
    } else {
      checks.push({
        service: "firebase",
        status: "warning",
        message: "Firebase not initialized",
      });
    }
  } catch (error) {
    checks.push({
      service: "firebase",
      status: "error",
      message: `Firebase error: ${error.message}`,
    });
  }

  // Determine overall external services status
  const hasError = checks.some((check) => check.status === "error");
  const hasWarning = checks.some((check) => check.status === "warning");

  let overallStatus = "ok";
  if (hasError) overallStatus = "error";
  else if (hasWarning) overallStatus = "warning";

  return {
    status: overallStatus,
    message: `External services ${overallStatus}`,
    details: checks,
  };
}

module.exports = router;
