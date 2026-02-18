import type { APIRoute } from "astro";
import { getServerSupabase, hasSupabaseEnv } from "../../lib/supabase";

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

export const GET: APIRoute = async ({ url }) => {
  if (!hasSupabaseEnv) {
    return json([], 200);
  }

  const postSlug = url.searchParams.get("postSlug");
  if (!postSlug) return json({ error: "缺少 postSlug 参数。" }, 400);

  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("comments")
      .select("id, post_slug, author_name, content, created_at")
      .eq("post_slug", postSlug)
      .eq("status", "approved")
      .order("created_at", { ascending: false });

    if (error) return json({ error: error.message }, 500);
    return json(data ?? []);
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
};

export const POST: APIRoute = async ({ request }) => {
  if (!hasSupabaseEnv) {
    return json({ ok: false, error: "Supabase 未配置，暂时无法提交评论。" }, 503);
  }

  let payload: { postSlug?: string; authorName?: string; content?: string };
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "请求体格式错误。" }, 400);
  }

  const postSlug = (payload.postSlug || "").trim();
  const authorName = (payload.authorName || "").trim();
  const content = (payload.content || "").trim();

  if (!postSlug || !authorName || !content) {
    return json({ ok: false, error: "参数不完整。" }, 400);
  }
  if (authorName.length > 40 || content.length > 1000) {
    return json({ ok: false, error: "内容超出长度限制。" }, 400);
  }

  try {
    const supabase = getServerSupabase();
    const { error } = await supabase.from("comments").insert({
      post_slug: postSlug,
      author_name: authorName,
      content,
      status: "approved",
    });
    if (error) return json({ ok: false, error: error.message }, 500);
    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: (error as Error).message }, 500);
  }
};
