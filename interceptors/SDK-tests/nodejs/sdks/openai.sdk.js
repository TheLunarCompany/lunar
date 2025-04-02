const OpenAI = require('openai');
const { NoProxyUseError } = require('../lunar');

const createResponseHeaders = (headers) => {
  return new Proxy(Object.fromEntries(
  // @ts-ignore
  headers.entries()), {
      get(target, name) {
          const key = name.toString();
          return target[key.toLowerCase()] || target[key];
      },
  });
};

function makeRequest(client, org) {
  return async function (optionsInput, retriesRemaining) {
    const { response, options, controller }  = await org.bind(client)(optionsInput, retriesRemaining);
    const responseHeaders = createResponseHeaders(response.headers);

    if (!responseHeaders['x-lunar-sequence-id']) {
      console.log(`Headers: ${JSON.stringify(responseHeaders)}`)
      throw new NoProxyUseError('x-lunar-sequence-id was not found in response headers');
    }

    return { response, options, controller }
  }

}

class sdkTests {
  amountOfIterations = 1;
  ai = new OpenAI({
    apiKey: process.env['OPENAI_API_KEY'],
  });

  constructor() {
    createResponseHeaders
  
  }

  getName() {
    return 'OpenAI';
  }
  
  async test() {
    console.log('Running OpenAI tests');
    for (let i = 0; i < this.amountOfIterations; i++) {
      try{ 
        await this.continueConversation(this.generatePrompt());

      } catch (error) {
        if (error instanceof NoProxyUseError) {
          throw error;
        }
        console.error('Error:', error.response ? error.response.data : error.message);
      }
    }
  }

  async testStream() {
    console.log('Running OpenAI stream tests');
    for (let i = 0; i < this.amountOfIterations; i++) {
      try {
        await this.continueConversationStream(this.generatePrompt());

      } catch (error) {
        if (error instanceof NoProxyUseError) {
          throw error;
        }
        console.error('Error:', error.response ? error.response.data : error.message);
      }
      }
  }

  async continueConversation(prompt) {
      const org = this.ai.chat.completions._client.makeRequest
      this.ai.chat.completions._client.makeRequest = makeRequest(this.ai.chat.completions._client, org);

      const chatCompletion = await this.ai.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'gpt-3.5-turbo',
      });

      const aiResponse = chatCompletion.choices[0]?.message?.content;
      console.log('AI:', aiResponse);
  }

  async continueConversationStream(prompt) {
    const org = this.ai.chat.completions._client.makeRequest
    this.ai.chat.completions._client.makeRequest = makeRequest(this.ai.chat.completions._client, org);

    const stream = await this.ai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'gpt-4',
      stream: true,
    });

    for await (const chunk of stream) {
      process.stdout.write(chunk.choices[0]?.delta?.content || '');
    }
  }

  generatePrompt() {
    // Define a list of possible conversation starters
    const conversationStarters = [
        "Let's talk about artificial intelligence.",
        "What do you think about the future of technology?",
        "Tell me about your favorite hobby.",
        // Add more conversation starters as needed
    ];

    // Select a random conversation starter
    const randomStarter = conversationStarters[Math.floor(Math.random() * conversationStarters.length)];

    return randomStarter;
  }

}

module.exports = sdkTests;