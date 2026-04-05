// Copy this code into your Cloudflare Worker script

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json",
    };

    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const apiKey = env.OPENAI_API_KEY; // Make sure to name your secret OPENAI_API_KEY in the Cloudflare Workers dashboard
    const apiUrl = "https://api.openai.com/v1/chat/completions";
    const userInput = await request.json();

    async function requestCompletion(messages) {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages,
          max_completion_tokens: 1000,
          temperature: 0.2,
          frequency_penalty: 0.2,
          presence_penalty: 0.2,
        }),
      });

      return response.json();
    }

    let messages = Array.isArray(userInput.messages) ? userInput.messages : [];
    let data = await requestCompletion(messages);
    let assistantMessage = data.choices?.[0]?.message?.content || "";
    let finishReason = data.choices?.[0]?.finish_reason;
    let attempts = 0;

    while (finishReason === "length" && attempts < 2 && assistantMessage) {
      attempts += 1;
      messages = messages.concat([
        { role: "assistant", content: assistantMessage },
        {
          role: "user",
          content:
            "Continue exactly from where you stopped. Do not repeat earlier text. Finish the response naturally.",
        },
      ]);

      data = await requestCompletion(messages);
      const nextMessage = data.choices?.[0]?.message?.content || "";
      assistantMessage += nextMessage;
      finishReason = data.choices?.[0]?.finish_reason;
    }

    if (data.choices?.[0]?.message) {
      data.choices[0].message.content = assistantMessage;
    }
    if (data.choices?.[0]) {
      data.choices[0].finish_reason = finishReason;
    }

    return new Response(JSON.stringify(data), { headers: corsHeaders });
  },
};
