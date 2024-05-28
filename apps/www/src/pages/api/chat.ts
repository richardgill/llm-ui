import { OpenAIStream, StreamingTextResponse } from "ai";
import type { APIRoute } from "astro";
import OpenAI from "openai";
import z from "zod";

export const prerender = false;

const chatRequestSchema = z.object({
  messages: z.any(),
  apiKey: z.string(),
  model: z.string(),
});

export const POST: APIRoute = async ({ request }) => {
  const jsonBody = await request.json();
  const result = chatRequestSchema.safeParse(jsonBody);
  if (!result.success) {
    return new Response(
      JSON.stringify({
        message: `Invalid request ${result.error.message}`,
      }),
      { status: 400 },
    );
  }
  const { apiKey, messages, model } = result.data;
  const openai = new OpenAI({
    apiKey,
  });
  const completion = await openai.chat.completions.create({
    model,
    messages: messages,
    stream: true,
  });
  const stream = OpenAIStream(completion);

  return new StreamingTextResponse(stream);
};
