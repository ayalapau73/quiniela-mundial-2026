exports.handler = async function(event, context) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      },
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  if (!OPENROUTER_API_KEY) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "OPENROUTER_API_KEY no configurada en Netlify" })
    };
  }

  try {
    const body = JSON.parse(event.body);
    const prompt = body.prompt;

    // plugin "web" activa búsqueda web (gratis, vía Exa) sobre un modelo gratis
    const callOpenRouter = () => fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.3-70b-instruct:free",
        plugins: [{ id: "web" }],
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 4000
      })
    });

    let response = await callOpenRouter();

    // El modelo gratis comparte cuota entre todos los usuarios de OpenRouter;
    // si está saturado (429), se reintenta una vez tras una breve espera.
    if (response.status === 429) {
      await new Promise(r => setTimeout(r, 4000));
      response = await callOpenRouter();
    }

    if (!response.ok) {
      const errTxt = await response.text();
      throw new Error(`OpenRouter error ${response.status}: ${errTxt}`);
    }

    const data = await response.json();
    const texto = data?.choices?.[0]?.message?.content || "";

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({ texto })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: err.message })
    };
  }
};
