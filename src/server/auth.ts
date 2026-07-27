import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { AgentConfig } from "../types.js";

export function requireBasicAuth(config: AgentConfig) {
  return (request: Request, response: Response, next: NextFunction): void => {
    if (!config.appAuthEnabled) {
      next();
      return;
    }

    if (!config.appUsername || !config.appPassword) {
      response.status(503).json({ error: "auth is enabled but APP_USERNAME or APP_PASSWORD is missing" });
      return;
    }

    const credentials = parseBasicAuth(request.headers.authorization);

    if (
      credentials &&
      secureEqual(credentials.username, config.appUsername) &&
      secureEqual(credentials.password, config.appPassword)
    ) {
      next();
      return;
    }

    response
      .status(401)
      .setHeader("www-authenticate", 'Basic realm="AI Web Search Agent", charset="UTF-8"')
      .send("Authentication required");
  };
}

function parseBasicAuth(header?: string): { username: string; password: string } | undefined {
  if (!header?.startsWith("Basic ")) {
    return undefined;
  }

  const decoded = Buffer.from(header.slice("Basic ".length), "base64").toString("utf8");
  const separatorIndex = decoded.indexOf(":");

  if (separatorIndex === -1) {
    return undefined;
  }

  return {
    username: decoded.slice(0, separatorIndex),
    password: decoded.slice(separatorIndex + 1)
  };
}

function secureEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
