// SECURITY NOTE: /upload is unauthenticated. Adding GitHub token validation
// is deferred to a future phase.

export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const url = new URL(request.url);

      // POST /upload — store a file in R2, return its public URL
      if (request.method === 'POST' && url.pathname === '/upload') {
        const formData = await request.formData();
        const file = formData.get('file');
        if (!file) {
          return new Response(JSON.stringify({ error: 'No file provided' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const key = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        await env.R2.put(key, file, {
          httpMetadata: { contentType: file.type },
        });

        return new Response(JSON.stringify({ url: `${env.PUBLIC_BASE_URL}/${key}` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // GET /list — list files in the bucket (max 1000; truncation logged if exceeded)
      if (request.method === 'GET' && url.pathname === '/list') {
        const listed = await env.R2.list();
        if (listed.truncated) {
          console.warn('R2 list truncated at 1000 objects — implement cursor pagination if needed');
        }
        const files = listed.objects.map((obj) => ({
          name: obj.key,
          url: `${env.PUBLIC_BASE_URL}/${obj.key}`,
          size: obj.size,
          uploaded: obj.uploaded,
        }));
        return new Response(JSON.stringify(files), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response('Not found', { status: 404, headers: corsHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};
