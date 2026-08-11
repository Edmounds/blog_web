import { createNeteaseQrLogin } from "../../../netease-auth.js";
import { error, getAdminStatus, handleError, json, requireSameOrigin } from "./common.js";

export async function onRequestPost({ env, request }) {
  try {
    requireSameOrigin(request);
    const status = await getAdminStatus(env);
    if (!status.auth.encryptionConfigured) {
      return error(503, "NETEASE_COOKIE_KEY_MISSING", "请先配置 NETEASE_COOKIE_KEY，再使用二维码登录。");
    }
    return json(await createNeteaseQrLogin());
  } catch (err) {
    return handleError(err, "QR create");
  }
}
