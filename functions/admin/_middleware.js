import { verifyAccess } from "../_shared/access.js";
import { error } from "../_shared/engagement.js";

export async function onRequest({ env, next, request }) {
  const identity = await verifyAccess(request, env);
  if (!identity) return error(401, "ACCESS_UNAUTHORIZED", "需要通过 Cloudflare Access 登录。");
  return next();
}
