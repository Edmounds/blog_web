import { env } from "cloudflare:workers";

export function getRuntimeEnv(): Cloudflare.Env {
  return env;
}
