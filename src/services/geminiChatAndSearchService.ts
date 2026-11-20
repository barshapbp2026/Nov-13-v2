import { Content, ThinkingLevel } from '@google/genai';
import {
  GeminiServiceError,
  isModelInCooldown,
  markModelInCooldown,
  runWithGeminiKeyFailover,
} from './geminiKeyPool.ts';
import type { ChatTaskMode, GroundingSource } from '../types';

export { GeminiServiceError };

const GENERAL_MODEL = 'gemini-4-hydrogen';
const FAST_MODEL = 'gemini-3.1-flash-lite';
const DEEP_MODEL = 'gemini-4-carbon';
const COMPLEX_MODEL = 'gemini-4-argon';

const LEGAL_CHAT_SYSTEM_INSTRUCTION = `तपाईं "नेपाली कानुनी दस्तावेजहरूको सङ्गालो" पोर्टलका विशेषज्ञ नेपाली कानुनी अनुसन्धान तथा भूमि-प्रशासन सहायक हुनुहुन्छ।

तपाईंको भूमिका र कार्यदिशा:
१. नेपालको संविधान २०७२, मुलुकी अपराध/देवानी/कार्यविधि संहिताहरू, जग्गा नापजाँच ऐन २०१९ तथा नियमावली, मालपोत ऐन २०३४ तथा नियमावली, भूउपयोग ऐन २०७६, भूमि सम्बन्धी ऐन २०२१, भूमि प्रशासन निर्देशिका २०८१, र भूमि समस्या समाधान आयोगका आदेश/कार्यविधिहरूका आधारमा स्पष्ट, तथ्यगत र सटीक मार्गदर्शन दिनुहोस्।
२. प्रयोगकर्ताले नेपालीमा सोधेमा १००% शुद्ध नेपाली देवनागरी युनिकोडमा र अङ्ग्रेजीमा सोधेमा स्पष्ट अङ्ग्रेजीमा उत्तर दिनुहोस्। अनावश्यक भूमिका वा दोहोरिने गफ नगरी सीधा बुँदागत र पढ्न सजिलो Markdown ढाँचामा जवाफ दिनुहोस्।
३. सम्भव भएसम्म सम्बन्धित ऐन, दफा, धारा वा अनुसूची उल्लेख गर्नुहोस्। यदि सक्रिय कागजात वा दफाको सन्दर्भ दिइएको छ भने सोही सन्दर्भलाई प्राथमिकता दिनुहोस्।
४. यदि Google Search Grounding (ताजा वेब खोज) सक्रिय छ भने, खोजबाट प्राप्त आधिकारिक नेपाल राजपत्र, कानुन आयोग वा सर्वोच्च अदालत सम्बन्धी पछिल्लो जानकारीलाई आधार मानी उत्तर दिनुहोस्।
५. उत्तरको अन्त्यमा वा आवश्यकतानुसार यो जानकारी शैक्षिक तथा अनुसन्धान प्रयोजनका लागि मात्र भएको र औपचारिक कानुनी परामर्शको सट्टा आधिकारिक राजपत्र र सम्बन्धित निकायको सूचना प्रमाणित गर्नुपर्ने स्मरण गराउनुहोस्।`;

const SEARCH_GROUNDING_SYSTEM_INSTRUCTION = `तपाईं नेपालका ऐन, नियम, नेपाल राजपत्र सूचना, संशोधन र सर्वोच्च अदालतका फैसलाहरूको अद्यावधिक स्थिति जाँच गर्ने कानुनी शोध सहायक हुनुहुन्छ।
Google Search बाट प्राप्त ताजा र भरपर्दा स्रोतहरूका आधारमा शुद्ध नेपाली युनिकोडमा स्पष्ट, संक्षिप्त र बुँदागत जानकारी प्रस्तुत गर्नुहोस्। अपुष्ट अनुमान नलेख्नुहोस्; पछिल्लो संशोधन वा सूचनाको मिति र सन्दर्भ उपलब्ध भएमा स्पष्ट खुलाउनुहोस्।`;

export interface ChatHistoryTurn {
  role: 'user' | 'model';
  text: string;
}

export interface ChatContextInfo {
  pdfName?: string;
  folderName?: string;
  sectionLabel?: string;
  summarySnippet?: string;
}

export interface LegalChatRequest {
  history?: ChatHistoryTurn[];
  message: string;
  taskMode?: ChatTaskMode;
  enableSearch?: boolean;
  activeContext?: ChatContextInfo;
}

export interface LegalChatResponse {
  reply: string;
  modelUsed: string;
  requestedModel: string;
  usedFallback: boolean;
  groundingSources: GroundingSource[];
  searchQueries: string[];
}

export interface SearchGroundingRequest {
  query: string;
  contextTitle?: string;
}

export interface SearchGroundingResponse {
  answer: string;
  modelUsed: string;
  requestedModel: string;
  usedFallback: boolean;
  groundingSources: GroundingSource[];
  searchQueries: string[];
}

function getModelChainForTaskMode(taskMode: ChatTaskMode): string[] {
  switch (taskMode) {
    case 'deep':
      return [DEEP_MODEL, GENERAL_MODEL, FAST_MODEL];
    case 'complex':
      return [COMPLEX_MODEL, GENERAL_MODEL, FAST_MODEL];
    case 'fast':
      return [FAST_MODEL, GENERAL_MODEL];
    case 'general':
    default:
      return [GENERAL_MODEL, FAST_MODEL];
  }
}

function getThinkingLevelForModel(model: string, taskMode: ChatTaskMode): ThinkingLevel {
  if (model === FAST_MODEL) {
    return ThinkingLevel.MINIMAL;
  }
  if (taskMode === 'deep') {
    return ThinkingLevel.HIGH;
  }
  if (taskMode === 'fast') {
    return ThinkingLevel.LOW;
  }
  return ThinkingLevel.MEDIUM;
}

function extractGroundingDetails(response: any): {
  groundingSources: GroundingSource[];
  searchQueries: string[];
} {
  const metadata = response?.candidates?.[0]?.groundingMetadata;
  const rawChunks = Array.isArray(metadata?.groundingChunks) ? metadata.groundingChunks : [];
  const seenUris = new Set<string>();
  const groundingSources: GroundingSource[] = [];

  for (const chunk of rawChunks) {
    const uri = String(chunk?.web?.uri || '').trim();
    const title = String(chunk?.web?.title || '').trim();
    if (!uri || seenUris.has(uri)) continue;
    seenUris.add(uri);
    groundingSources.push({
      uri,
      title: title || uri,
    });
  }

  const searchQueries: string[] = Array.isArray(metadata?.webSearchQueries)
    ? metadata.webSearchQueries.map((q: any) => String(q || '').trim()).filter(Boolean)
    : [];

  return { groundingSources, searchQueries };
}

function buildSystemInstructionWithContext(activeContext?: ChatContextInfo): string {
  if (!activeContext) return LEGAL_CHAT_SYSTEM_INSTRUCTION;
  const parts: string[] = [];
  if (activeContext.folderName) parts.push(`फोल्डर: ${activeContext.folderName}`);
  if (activeContext.pdfName) parts.push(`सक्रिय दस्तावेज: ${activeContext.pdfName}`);
  if (activeContext.sectionLabel) parts.push(`सक्रिय दफा/धारा: ${activeContext.sectionLabel}`);
  if (activeContext.summarySnippet) {
    parts.push(`दस्तावेज/दफा सन्दर्भ:\n${activeContext.summarySnippet.slice(0, 1800)}`);
  }
  if (parts.length === 0) return LEGAL_CHAT_SYSTEM_INSTRUCTION;
  return `${LEGAL_CHAT_SYSTEM_INSTRUCTION}\n\n=== हालको सक्रिय पोर्टल सन्दर्भ ===\n${parts.join('\n')}`;
}

function shouldFallbackFromModelError(err: any): { fallback: boolean; cooldownMs: number } {
  const status = typeof err?.status === 'number' ? err.status : 0;
  const msg = String(err?.message || err || '').toLowerCase();
  // Paid-tier restriction, unsupported model/tool, permission denied, or invalid argument -> long cooldown + fallback
  if (
    status === 400 ||
    status === 401 ||
    status === 403 ||
    status === 404 ||
    msg.includes('permission_denied') ||
    msg.includes('billing') ||
    msg.includes('paid') ||
    msg.includes('not_found') ||
    msg.includes('not supported')
  ) {
    return { fallback: true, cooldownMs: 5 * 60_000 };
  }
  // Rate limits or transient upstream overload -> short cooldown + fallback
  if (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    msg.includes('timeout') ||
    msg.includes('unavailable') ||
    msg.includes('quota')
  ) {
    return { fallback: true, cooldownMs: 60_000 };
  }
  return { fallback: false, cooldownMs: 0 };
}

export async function chatWithLegalAssistant(
  req: LegalChatRequest
): Promise<LegalChatResponse> {
  const message = String(req.message || '').trim();
  if (!message) {
    throw new GeminiServiceError(400, 'कृपया प्रश्न वा सन्देश लेख्नुहोस्।');
  }

  const taskMode: ChatTaskMode = ['general', 'deep', 'complex', 'fast'].includes(
    String(req.taskMode)
  )
    ? (req.taskMode as ChatTaskMode)
    : 'general';

  const enableSearch = Boolean(req.enableSearch);
  const modelChain = getModelChainForTaskMode(taskMode);
  const requestedModel = modelChain[0];

  const recentHistory: Content[] = (Array.isArray(req.history) ? req.history : [])
    .filter(turn => turn && (turn.role === 'user' || turn.role === 'model') && String(turn.text || '').trim())
    .slice(-18)
    .map(turn => ({
      role: turn.role,
      parts: [{ text: String(turn.text).trim() }],
    }));

  const systemInstruction = buildSystemInstructionWithContext(req.activeContext);

  let lastError: any = null;

  for (let i = 0; i < modelChain.length; i++) {
    const candidateModel = modelChain[i];
    const hasNextFallback = i < modelChain.length - 1;

    if (hasNextFallback && isModelInCooldown(candidateModel)) {
      continue;
    }

    const isPaidPrimary =
      (candidateModel === DEEP_MODEL || candidateModel === COMPLEX_MODEL) && hasNextFallback;
    const timeoutMs = 10_500;
    // Cap primary model attempt strictly when a fast fallback exists so total HTTP latency stays well below proxy timeouts
    const budgetMs = hasNextFallback ? 11_200 : 22_000;
    const maxAttempts = isPaidPrimary ? 1 : hasNextFallback ? 2 : undefined;

    try {
      const response = await runWithGeminiKeyFailover(
        async ai => {
          const config: Record<string, any> = {
            systemInstruction,
            thinkingConfig: {
              thinkingLevel: getThinkingLevelForModel(candidateModel, taskMode),
            },
          };
          if (enableSearch) {
            config.tools = [{ googleSearch: {} }];
          }

          const chat = ai.chats.create({
            model: candidateModel,
            history: recentHistory,
            config,
          });
          return chat.sendMessage({ message });
        },
        enableSearch ? `${candidateModel}` : candidateModel,
        {
          timeoutMs,
          budgetMs,
          maxAttempts,
        }
      );

      const replyText = String(response.text || '').trim();
      if (!replyText) {
        throw new GeminiServiceError(502, 'AI बाट खाली जवाफ प्राप्त भयो।');
      }

      const { groundingSources, searchQueries } = extractGroundingDetails(response);
      return {
        reply: replyText,
        modelUsed: candidateModel,
        requestedModel,
        usedFallback: candidateModel !== requestedModel,
        groundingSources,
        searchQueries,
      };
    } catch (err: any) {
      lastError = err;
      const { fallback, cooldownMs } = shouldFallbackFromModelError(err);
      if (hasNextFallback && fallback) {
        markModelInCooldown(candidateModel, cooldownMs);
        continue;
      }
      // If Google Search Grounding exhausted quota on free keys during chat, retry once cleanly without search tool
      if (enableSearch && !hasNextFallback && (err?.status === 429 || err?.status === 403)) {
        try {
          const plainRes = await runWithGeminiKeyFailover(
            ai => {
              const chat = ai.chats.create({
                model: FAST_MODEL,
                history: recentHistory,
                config: {
                  systemInstruction,
                  thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
                },
              });
              return chat.sendMessage({ message });
            },
            FAST_MODEL,
            { timeoutMs: 12_000, budgetMs: 22_000 }
          );
          const replyText = String(plainRes.text || '').trim();
          if (replyText) {
            return {
              reply: `${replyText}\n\n*(नोट: निःशुल्क कुञ्जी कोटामा Google वेब खोज सीमा पुगेकाले आधारभूत कानुनी ज्ञानका आधारमा उत्तर दिइएको छ।)*`,
              modelUsed: FAST_MODEL,
              requestedModel,
              usedFallback: true,
              groundingSources: [],
              searchQueries: [],
            };
          }
        } catch {
          // fall through to original error
        }
      }
      if (err instanceof GeminiServiceError) throw err;
      throw new GeminiServiceError(
        typeof err?.status === 'number' ? err.status : 500,
        err?.message || 'च्याट जवाफ तयार गर्न असफल भयो।'
      );
    }
  }

  if (lastError instanceof GeminiServiceError) throw lastError;
  throw new GeminiServiceError(503, lastError?.message || 'कुनै पनि Gemini मोडल उपलब्ध हुन सकेन।');
}

export async function searchLegalUpdatesWithGrounding(
  req: SearchGroundingRequest
): Promise<SearchGroundingResponse> {
  const rawQuery = String(req.query || '').trim();
  if (!rawQuery) {
    throw new GeminiServiceError(400, 'कृपया खोज्न चाहेको कानुनी विषय वा प्रश्न लेख्नुहोस्।');
  }

  const contextPrefix = req.contextTitle
    ? `सन्दर्भ दस्तावेज: "${req.contextTitle}"\n\nखोज प्रश्न: `
    : 'नेपाल कानुन सम्बन्धी खोज प्रश्न: ';

  const fullPrompt = `${contextPrefix}${rawQuery}\n\nनिर्देशन: Google Search प्रयोग गरी आधिकारिक नेपाल राजपत्र, कानुन आयोग वा सम्बन्धित सरकारी पोर्टलहरूमा उपलब्ध पछिल्लो अद्यावधिक, संशोधन मिति वा मुख्य तथ्य नेपालीमा संक्षेपमा प्रस्तुत गर्नुहोस्।`;

  const modelChain = [GENERAL_MODEL, FAST_MODEL];
  let lastError: any = null;

  for (let i = 0; i < modelChain.length; i++) {
    const model = modelChain[i];
    const hasNextFallback = i < modelChain.length - 1;
    if (hasNextFallback && isModelInCooldown(model)) {
      continue;
    }

    try {
      const response = await runWithGeminiKeyFailover(
        ai =>
          ai.models.generateContent({
            model,
            contents: fullPrompt,
            config: {
              systemInstruction: SEARCH_GROUNDING_SYSTEM_INSTRUCTION,
              tools: [{ googleSearch: {} }],
              thinkingConfig: {
                thinkingLevel: model === FAST_MODEL ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW,
              },
            },
          }),
        model,
        {
          timeoutMs: 10_500,
          budgetMs: hasNextFallback ? 11_200 : 22_000,
          maxAttempts: hasNextFallback ? 2 : undefined,
        }
      );

      const answer = String(response.text || '').trim();
      if (!answer) {
        throw new GeminiServiceError(502, 'Google Search ग्राउन्डिङबाट खाली जवाफ आयो।');
      }

      const { groundingSources, searchQueries } = extractGroundingDetails(response);
      return {
        answer,
        modelUsed: model,
        requestedModel: GENERAL_MODEL,
        usedFallback: model !== GENERAL_MODEL,
        groundingSources,
        searchQueries,
      };
    } catch (err: any) {
      lastError = err;
      const { fallback, cooldownMs } = shouldFallbackFromModelError(err);
      if (hasNextFallback && fallback) {
        markModelInCooldown(model, cooldownMs);
        continue;
      }
      if (err instanceof GeminiServiceError) throw err;
      throw new GeminiServiceError(
        typeof err?.status === 'number' ? err.status : 500,
        err?.message || 'Google Search ग्राउन्डिङ असफल भयो।'
      );
    }
  }

  if (lastError instanceof GeminiServiceError) throw lastError;
  throw new GeminiServiceError(503, lastError?.message || 'Google Search ग्राउन्डिङ उपलब्ध हुन सकेन।');
}
