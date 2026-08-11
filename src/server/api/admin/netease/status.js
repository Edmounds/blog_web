import { getAdminStatus, handleError, json } from "./common.js";

export async function onRequestGet({ env }) {
  try {
    return json(await getAdminStatus(env));
  } catch (err) {
    return handleError(err, "status");
  }
}
