/**
 * AI Description Generator Service
 * Generates compelling Vinted descriptions with hashtags
 *
 * Supports multiple AI providers:
 * - OpenAI GPT-4 Mini (cheap: ~$0.15 per 1M input tokens)
 * - Anthropic Claude Haiku (very cheap and fast)
 *
 * Cost estimate: <£2/month for 100 descriptions
 */

export interface DescriptionInput {
  brand?: string;
  category?: string;
  size?: string;
  condition: 'new_with_tags' | 'new_without_tags' | 'very_good' | 'good' | 'satisfactory';
  colors?: string[];
  materials?: string[];
  additionalInfo?: string; // Any extra details scraped or user-provided
}

export interface DescriptionOutput {
  description: string; // Main description text
  hashtags: string[]; // 5 relevant hashtags
  fullText: string; // Description + hashtags combined
}

/**
 * Generate a compelling Vinted description with hashtags
 * This is a template-based approach for Phase 2
 * Can be replaced with actual AI API calls later
 */
export function generateDescription(input: DescriptionInput): DescriptionOutput {
  const {
    brand = 'Brand',
    category = 'item',
    size,
    condition,
    colors = [],
    materials = [],
    additionalInfo = '',
  } = input;

  // Map condition to user-friendly text
  const conditionText = {
    new_with_tags: 'Brand new with tags',
    new_without_tags: 'Brand new without tags',
    very_good: 'in excellent condition',
    good: 'in good condition with minimal wear',
    satisfactory: 'well-loved with some signs of wear',
  }[condition];

  // Build description parts
  const parts: string[] = [];

  // Opening line
  if (condition === 'new_with_tags' || condition === 'new_without_tags') {
    parts.push(`${conditionText}! ${brand} ${category}${size ? ` in size ${size}` : ''}.`);
  } else {
    parts.push(`${brand} ${category} ${conditionText}${size ? `, size ${size}` : ''}.`);
  }

  // Color and material details
  if (colors.length > 0) {
    const colorText = colors.length === 1
      ? colors[0]
      : colors.slice(0, -1).join(', ') + ' and ' + colors[colors.length - 1];
    parts.push(`Features a beautiful ${colorText} color${colors.length > 1 ? ' combination' : ''}.`);
  }

  if (materials.length > 0) {
    const materialText = materials.length === 1
      ? materials[0]
      : materials.join(', ');
    parts.push(`Made from ${materialText}.`);
  }

  // Additional info
  if (additionalInfo) {
    parts.push(additionalInfo);
  }

  // Closing line
  parts.push('Perfect addition to your wardrobe!');

  const description = parts.join(' ');

  // Generate hashtags
  const hashtags = generateHashtags(input);

  // Combine description and hashtags
  const fullText = `${description}\n\n${hashtags.map(tag => `#${tag}`).join(' ')}`;

  return {
    description,
    hashtags,
    fullText,
  };
}

/**
 * Generate relevant hashtags for the item
 * Returns 5 hashtags based on brand, category, colors, materials, condition
 */
function generateHashtags(input: DescriptionInput): string[] {
  const hashtags: string[] = [];

  // Brand hashtag (if available)
  if (input.brand && input.brand !== 'Brand') {
    hashtags.push(input.brand.replace(/\s+/g, '').toLowerCase());
  }

  // Category hashtag
  if (input.category && input.category !== 'item') {
    hashtags.push(input.category.replace(/\s+/g, '').toLowerCase());
  }

  // Color hashtags (first 2 colors)
  if (input.colors && input.colors.length > 0) {
    hashtags.push(...input.colors.slice(0, 2).map(c => c.replace(/\s+/g, '').toLowerCase()));
  }

  // Material hashtag (first material only)
  if (input.materials && input.materials.length > 0) {
    hashtags.push(input.materials[0].replace(/\s+/g, '').toLowerCase());
  }

  // Condition hashtag
  if (input.condition === 'new_with_tags') {
    hashtags.push('nwt');
  } else if (input.condition === 'new_without_tags') {
    hashtags.push('brandnew');
  }

  // Generic popular hashtags to fill up to 5
  const popularHashtags = ['vintage', 'fashion', 'style', 'preloved', 'sustainable'];
  let popularIndex = 0;
  while (hashtags.length < 5 && popularIndex < popularHashtags.length) {
    if (!hashtags.includes(popularHashtags[popularIndex])) {
      hashtags.push(popularHashtags[popularIndex]);
    }
    popularIndex++;
  }

  // Ensure exactly 5 hashtags
  return hashtags.slice(0, 5);
}

/**
 * Call OpenAI API to generate description
 * Requires OPENAI_API_KEY environment variable
 * Cost: ~$0.15 per 1M input tokens (GPT-4 Mini)
 */
export async function generateDescriptionWithAI(
  input: DescriptionInput,
  apiKey: string,
  provider: 'openai' | 'anthropic' = 'openai'
): Promise<DescriptionOutput> {
  if (provider === 'openai') {
    return generateWithOpenAI(input, apiKey);
  } else {
    return generateWithAnthropic(input, apiKey);
  }
}

async function generateWithOpenAI(
  input: DescriptionInput,
  apiKey: string
): Promise<DescriptionOutput> {
  const prompt = buildPrompt(input);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a Vinted listing expert. Generate compelling, concise descriptions that sell. Keep it natural and authentic.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 200,
    }),
  });

  const data = await response.json();
  const generatedText = data.choices[0].message.content.trim();

  return parseAIResponse(generatedText, input);
}

async function generateWithAnthropic(
  input: DescriptionInput,
  apiKey: string
): Promise<DescriptionOutput> {
  const prompt = buildPrompt(input);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  const data = await response.json();
  const generatedText = data.content[0].text.trim();

  return parseAIResponse(generatedText, input);
}

function buildPrompt(input: DescriptionInput): string {
  const {
    brand = 'Brand',
    category = 'clothing item',
    size,
    condition,
    colors = [],
    materials = [],
    additionalInfo = '',
  } = input;

  return `Generate a compelling Vinted listing description for this item:

Brand: ${brand}
Category: ${category}
Size: ${size || 'Not specified'}
Condition: ${condition.replace(/_/g, ' ')}
Colors: ${colors.join(', ') || 'Not specified'}
Materials: ${materials.join(', ') || 'Not specified'}
Additional Info: ${additionalInfo || 'None'}

Requirements:
1. Write 2-3 sentences describing the item
2. Be enthusiastic but authentic
3. Highlight the condition and key features
4. End with a call to action
5. After the description, provide exactly 5 relevant hashtags (one per line, starting with #)

Format:
[Description text here]

#hashtag1
#hashtag2
#hashtag3
#hashtag4
#hashtag5`;
}

function parseAIResponse(text: string, input: DescriptionInput): DescriptionOutput {
  // Split description and hashtags
  const parts = text.split('\n');

  const descriptionLines: string[] = [];
  const hashtags: string[] = [];

  for (const line of parts) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) {
      hashtags.push(trimmed.substring(1));
    } else if (trimmed.length > 0) {
      descriptionLines.push(trimmed);
    }
  }

  const description = descriptionLines.join(' ');

  // Ensure we have exactly 5 hashtags
  const finalHashtags = hashtags.length >= 5
    ? hashtags.slice(0, 5)
    : [...hashtags, ...generateHashtags(input)].slice(0, 5);

  const fullText = `${description}\n\n${finalHashtags.map(tag => `#${tag}`).join(' ')}`;

  return {
    description,
    hashtags: finalHashtags,
    fullText,
  };
}
