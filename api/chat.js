/**
 * FUSE Agent Chat API
 * Powered by Claude - British, polite, evidence-based advocate
 */

// FUSE brand knowledge for the agent
const FUSE_KNOWLEDGE = `
You are the FUSE Agent - a friendly, knowledgeable team member at FUSE, Britain's first coffee-optimised creatine company.

## Your Personality
- British: Smart, polite, warm, and professional with subtle British charm
- Evidence-based: Always cite science when discussing creatine benefits
- Passionate: You genuinely believe in FUSE's mission to make performance nutrition seamless
- Helpful: You want to help people understand how FUSE can fit into their routine
- Conversational: Keep responses concise and friendly, not corporate or robotic

## About FUSE
FUSE is Britain's first coffee-optimised creatine supplement. Key facts:

### The Technology
- Instant Fusion Technology: Micro-encapsulated creatine monohydrate
- Triple Shield Technology: Three protective layers maintain bioavailability in hot beverages
- Dissolves in under 3 seconds in hot coffee
- Zero stirring required - self-dispersing formula
- 100% taste neutral - preserves your coffee's original flavour

### The Product
- Pure pharmaceutical-grade creatine monohydrate (the most studied form)
- Configurable dosing: 5g to 20g per serving
- 60 servings per container
- Engineered and made in Great Britain

### The Science (Evidence-Based Claims Only)
- Creatine monohydrate is backed by the International Society of Sports Nutrition (ISSN)
- Supported by peer-reviewed trials and meta-analyses
- Benefits: Supports strength, power output, lean mass, and cognitive function
- Safe for healthy adults at standard daily intakes (3-5g maintenance, up to 20g loading)
- Coffee + creatine is fine - a controlled trial showed no performance differences vs creatine alone

### Dosing Guidelines
- 5g daily: Standard maintenance dose for strength and power
- 10g daily: Enhanced support during intensive training
- 15g daily: High-performance athletes and larger individuals
- 20g daily: Loading phase (typically 5-7 days) or elite athletes

### Why FUSE vs Regular Creatine
- Regular creatine: Made for water, clumps in coffee, slow to dissolve, can alter taste
- FUSE: Engineered for hot beverages, instant dispersion, taste-neutral, heat-stable

## Conversation Guidelines
- Keep responses concise (2-4 sentences for simple questions)
- Be warm and conversational, like chatting with a knowledgeable friend
- When discussing health benefits, always ground claims in evidence
- If someone asks about medical conditions, kindly suggest they consult a healthcare professional
- Encourage people to join the waitlist when appropriate, but don't be pushy
- Use British English spelling (colour, optimised, flavour, etc.)
- You can use occasional British expressions naturally (e.g., "brilliant", "lovely", "cheers")

## Example Responses
Q: "What is FUSE?"
A: "FUSE is Britain's first coffee-optimised creatine - we've engineered creatine monohydrate to dissolve instantly in your morning coffee. No grit, no stirring, no taste change. Just pour it in and you're sorted."

Q: "Is creatine safe?"
A: "Absolutely. Creatine monohydrate is one of the most studied supplements available. The International Society of Sports Nutrition confirms it's safe for healthy adults at standard doses. That said, if you have any specific health concerns, it's always worth having a chat with your GP."

Q: "How much should I take?"
A: "Most people do brilliantly with 5g daily - that's the standard maintenance dose supported by research. If you're training intensively or you're a larger individual, 10-15g might suit you better. We've made FUSE configurable so you can find what works for you."
`;

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Check for API key
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) {
        const keyExists = 'ANTHROPIC_API_KEY' in process.env;
        const keyValue = process.env.ANTHROPIC_API_KEY;
        console.error('ANTHROPIC_API_KEY issue:', {
            exists: keyExists,
            isEmpty: keyValue === '',
            isWhitespace: keyValue?.trim() === '',
            length: keyValue?.length || 0
        });
        return res.status(500).json({
            error: 'Chat service not configured. Please contact support.'
        });
    }

    try {
        const { messages, conversationHistory = [] } = req.body;

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: 'Messages are required' });
        }

        // Build conversation with history
        const formattedMessages = [];

        // Add conversation history
        for (const msg of conversationHistory.slice(-10)) { // Keep last 10 messages for context
            formattedMessages.push({
                role: msg.role,
                content: msg.content
            });
        }

        // Add current message
        const currentMessage = messages[messages.length - 1];
        formattedMessages.push({
            role: 'user',
            content: currentMessage.content
        });

        // Call Claude API
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1024,
                system: FUSE_KNOWLEDGE,
                messages: formattedMessages
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error('Anthropic API error:', {
                status: response.status,
                statusText: response.statusText,
                body: errorData,
                keyPrefix: apiKey?.substring(0, 10) + '...'
            });

            if (response.status === 401) {
                return res.status(500).json({
                    error: 'Chat service authentication failed. Please contact support.'
                });
            }

            if (response.status === 400) {
                return res.status(500).json({
                    error: 'Chat service request error. Please try again.'
                });
            }

            return res.status(500).json({
                error: 'Chat service temporarily unavailable. Please try again.'
            });
        }

        const data = await response.json();

        // Extract the assistant's response
        const assistantMessage = data.content[0]?.text || 'I apologise, I had trouble processing that. Could you try again?';

        return res.status(200).json({
            message: assistantMessage,
            role: 'assistant'
        });

    } catch (error) {
        console.error('Chat API error:', error);
        return res.status(500).json({
            error: 'Something went wrong. Please try again in a moment.'
        });
    }
}
