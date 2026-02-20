const fs = require('fs');
const OpenAI = require('openai');
require('dotenv').config({ path: 'backend/.env' });

const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY
});

async function test() {
  const b64 = fs.readFileSync('backend/test.pdf').toString('base64');
  const res = await openrouter.chat.completions.create({
    model: 'google/gemini-3-flash-preview',
    messages: [{
      role: 'user',
      content: [
         { type: 'text', text: 'What is this file? Describe it in detail.' },
         { type: 'image_url', image_url: { url: `data:application/pdf;base64,${b64}` } }
      ]
    }]
  });
  console.log(res.choices[0].message.content);
}
test().catch(console.error);
