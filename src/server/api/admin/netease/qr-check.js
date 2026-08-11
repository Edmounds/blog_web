import { checkNeteaseQrLogin } from "../../../netease-auth.js";
import { error, handleError, json, readSameOriginJson } from "./common.js";

export async function onRequestPost({ env, request }) {
  try {
    const body = await readSameOriginJson(request);
    if (!body || typeof body !== "object" || typeof body.key !== "string") {
      return error(400, "NETEASE_QR_KEY_INVALID", "二维码登录状态无效。");
    }
    return json(await checkNeteaseQrLogin(env, body.key));
  } catch (err) {
    return handleError(err, "QR check");
  }
}
