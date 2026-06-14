require('dotenv').config();

const apiKey = process.env.DIFY_API_KEY;
const difyApiUrl = process.env.DIFY_API_URL || 'https://api.dify.ai/v1/chat-messages';

console.log('=== Debug Dify API Response ===');
console.log('API Key:', apiKey ? 'Configured' : 'Not configured');
console.log('API URL:', difyApiUrl);
console.log('================================\n');

async function testDify() {
  console.log('Sending request to Dify...\n');
  
  const response = await fetch(difyApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      inputs: {},
      query: '你好',
      user: 'test-user',
      response_mode: 'streaming'
    })
  });

  console.log('Response status:', response.status);
  console.log('Response headers:', JSON.stringify(Object.fromEntries(response.headers), null, 2));
  
  if (!response.ok) {
    const text = await response.text();
    console.error('\nAPI Error:', text);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let eventCount = 0;

  console.log('\n=== Streaming Response ===');

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value, { stream: true });
    buffer += chunk;
    
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        eventCount++;
        const dataStr = line.substring('data: '.length);
        if (dataStr === '[DONE]') {
          console.log(`[Event ${eventCount}] END STREAM`);
          break;
        }
        try {
          const data = JSON.parse(dataStr);
          console.log(`[Event ${eventCount}] Type: ${data.event || data.type || 'unknown'}`);
          console.log('Data:', JSON.stringify(data, null, 2));
          console.log('---');
        } catch (e) {
          console.log(`[Event ${eventCount}] Raw:`, dataStr);
        }
      }
    }
  }

  console.log('\n=== Summary ===');
  console.log('Total events received:', eventCount);
}

testDify().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});