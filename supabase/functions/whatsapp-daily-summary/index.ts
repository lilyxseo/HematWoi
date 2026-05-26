Deno.serve(async (req: Request) => {
  const cronSecret = req.headers.get("x-cron-secret");
  const expectedSecret = Deno.env.get("CRON_SECRET");

  if (!expectedSecret || cronSecret !== expectedSecret) {
    return new Response(JSON.stringify({ ok: false, message: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  console.log("DAILY SUMMARY CRON WORKING");

  return new Response(
    JSON.stringify({ ok: true, message: "Daily summary cron working" }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
});
