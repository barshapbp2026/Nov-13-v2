import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Send,
  Sparkles,
  Search,
  Globe,
  Bot,
  User as UserIcon,
  Trash2,
  ExternalLink,
  Zap,
  Brain,
  Cpu,
  MessageSquareText,
  RefreshCw,
  AlertTriangle,
  Copy,
  Check,
  BookOpen,
} from 'lucide-react';
import { marked } from 'marked';
import type { ChatTaskMode, GroundingSource, LegalChatMessage } from '../types';
import { safeFetchJson } from '../utils/safeFetchJson';
import { FontSizeControls } from './FontSizeControls';

export interface ActiveChatContext {
  pdfName?: string;
  folderName?: string;
  sectionLabel?: string;
  summarySnippet?: string;
}

interface LegalChatbotDrawerProps {
  isOpen: boolean;
  initialTab?: 'chat' | 'search';
  initialSearchQuery?: string;
  activeContext?: ActiveChatContext | null;
  onClearContext?: () => void;
  onClose: () => void;
}

const TASK_MODE_OPTIONS: {
  id: ChatTaskMode;
  label: string;
  modelName: string;
  desc: string;
  icon: React.ReactNode;
}[] = [
  {
    id: 'general',
    label: 'सामान्य',
    modelName: 'gemini-4-hydrogen',
    desc: 'दैनिक कानुनी प्रश्न र स्पष्ट व्याख्या',
    icon: <Sparkles className="w-3.5 h-3.5" />,
  },
  {
    id: 'fast',
    label: 'छिटो',
    modelName: 'gemini-3.1-flash-lite',
    desc: 'तुरुन्त र छरितो उत्तर',
    icon: <Zap className="w-3.5 h-3.5" />,
  },
  {
    id: 'deep',
    label: 'गहन तर्क',
    modelName: 'gemini-4-carbon',
    desc: 'जटिल विश्लेषण (उपलब्ध नभए स्वतः Fallback)',
    icon: <Brain className="w-3.5 h-3.5" />,
  },
  {
    id: 'complex',
    label: 'अन्तरक्रियात्मक',
    modelName: 'gemini-4-argon',
    desc: 'बहु-ऐन तुलना (उपलब्ध नभए स्वतः Fallback)',
    icon: <Cpu className="w-3.5 h-3.5" />,
  },
];

const CHAT_STARTER_PROMPTS = [
  'जग्गा नापजाँच ऐन, २०१९ र आठौँ संशोधनका मुख्य प्रावधान के के हुन्?',
  'नेपालको संविधान २०७२ अनुसार सम्पत्ति सम्बन्धी मौलिक हक (धारा २५) बुझाइदिनुहोस्।',
  'मालपोत ऐन र भूमि प्रशासन निर्देशिका २०८१ अनुसार जग्गा नामसारी प्रक्रिया कस्तो छ?',
  'भूमि समस्या समाधान आयोगको पछिल्लो राजपत्र सूचना र अद्यावधिक अवस्था के छ?',
];

const SEARCH_PRESET_QUERIES = [
  'नेपाल राजपत्र भूमि तथा मालपोत सम्बन्धी पछिल्लो संशोधन सूचना',
  'जग्गा नापजाँच ऐन २०१९ पछिल्लो संशोधन नेपाल कानुन आयोग',
  'भूउपयोग नियमावली २०७९ जग्गा वर्गीकरण सम्बन्धी हालको नीति',
  'भूमि समस्या समाधान आयोग हालको गठन आदेश र कार्यविधि',
];

function renderSafeMarkdownHtml(markdownText: string): string {
  const escaped = String(markdownText || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const html = marked.parse(escaped, { async: false, breaks: true, gfm: true }) as string;
  return html.replace(/<a\s+href=/gi, '<a target="_blank" rel="noopener noreferrer" href=');
}

export const LegalChatbotDrawer: React.FC<LegalChatbotDrawerProps> = ({
  isOpen,
  initialTab = 'chat',
  initialSearchQuery = '',
  activeContext = null,
  onClearContext,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'search'>(initialTab);
  const [taskMode, setTaskMode] = useState<ChatTaskMode>('general');
  const [enableSearchInChat, setEnableSearchInChat] = useState<boolean>(false);
  const [messages, setMessages] = useState<LegalChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: 'नमस्ते! म **नेपाली कानुनी दस्तावेज सहायक** हुँ। तपाईं मलाई संविधान, मुलुकी संहिता, जग्गा नापजाँच ऐन, मालपोत, भूउपयोग वा भूमि आयोग सम्बन्धी कुनै पनि कानुनी प्रश्न सोध्न सक्नुहुन्छ।\n\nताजा संशोधन र राजपत्र जानकारीका लागि **Google Search सहित** मोड खुला राख्नुहोस् वा माथिको **ताजा कानुनी खोज** ट्याब प्रयोग गर्नुहोस्।',
      createdAt: new Date().toISOString(),
      modelUsed: 'gemini-4-hydrogen',
    },
  ]);
  const [chatInput, setChatInput] = useState<string>('');
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string>('');

  // Standalone Google Search Grounding tab state
  const [searchQuery, setSearchQuery] = useState<string>(initialSearchQuery);
  const [searchLoading, setSearchLoading] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string>('');
  const [searchResult, setSearchResult] = useState<{
    query: string;
    answer: string;
    modelUsed: string;
    usedFallback: boolean;
    groundingSources: GroundingSource[];
    searchQueries: string[];
  } | null>(null);

  const threadEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab);
    if (initialSearchQuery) {
      setSearchQuery(initialSearchQuery);
    }
  }, [isOpen, initialTab, initialSearchQuery]);

  useEffect(() => {
    if (threadEndRef.current) {
      threadEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages.length, chatLoading]);

  if (!isOpen) return null;

  const handleSendMessage = async (overrideText?: string) => {
    const text = (overrideText ?? chatInput).trim();
    if (!text || chatLoading) return;

    setChatError('');
    if (!overrideText) setChatInput('');

    const userMsg: LegalChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      text,
      createdAt: new Date().toISOString(),
      taskMode,
    };

    const historyPayload = messages
      .filter(m => m.id !== 'welcome')
      .map(m => ({ role: m.role, text: m.text }));

    setMessages(prev => [...prev, userMsg]);
    setChatLoading(true);

    try {
      const { ok, data } = await safeFetchJson('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: historyPayload,
          message: text,
          taskMode,
          enableSearch: enableSearchInChat,
          activeContext: activeContext || undefined,
        }),
      });

      if (!ok || !data?.success || !data?.reply) {
        setChatError(data?.error || 'च्याट जवाफ प्राप्त गर्न सकिएन।');
        return;
      }

      const botMsg: LegalChatMessage = {
        id: `model_${Date.now()}`,
        role: 'model',
        text: data.reply,
        createdAt: new Date().toISOString(),
        taskMode,
        modelUsed: data.modelUsed,
        requestedModel: data.requestedModel,
        usedFallback: Boolean(data.usedFallback),
        groundingSources: Array.isArray(data.groundingSources) ? data.groundingSources : [],
        searchQueries: Array.isArray(data.searchQueries) ? data.searchQueries : [],
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      setChatError(err?.message || 'सर्भरसँग सम्पर्क हुन सकेन।');
    } finally {
      setChatLoading(false);
    }
  };

  const handleClearChat = () => {
    setChatError('');
    setMessages([
      {
        id: 'welcome',
        role: 'model',
        text: 'नयाँ कानुनी संवाद सुरु भयो। कृपया आफ्नो प्रश्न सोध्नुहोस्।',
        createdAt: new Date().toISOString(),
        modelUsed: TASK_MODE_OPTIONS.find(m => m.id === taskMode)?.modelName || 'gemini-4-hydrogen',
      },
    ]);
  };

  const handleRunSearchGrounding = async (overrideQuery?: string) => {
    const q = (overrideQuery ?? searchQuery).trim();
    if (!q || searchLoading) return;
    if (overrideQuery) setSearchQuery(overrideQuery);

    setSearchError('');
    setSearchLoading(true);
    try {
      const { ok, data } = await safeFetchJson('/api/gemini/search-grounding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          contextTitle: activeContext?.pdfName,
        }),
      });
      if (!ok || !data?.success || !data?.answer) {
        setSearchError(data?.error || 'Google Search बाट जानकारी ल्याउन सकिएन।');
        return;
      }
      setSearchResult({
        query: q,
        answer: data.answer,
        modelUsed: data.modelUsed || 'gemini-4-hydrogen',
        usedFallback: Boolean(data.usedFallback),
        groundingSources: Array.isArray(data.groundingSources) ? data.groundingSources : [],
        searchQueries: Array.isArray(data.searchQueries) ? data.searchQueries : [],
      });
    } catch (err: any) {
      setSearchError(err?.message || 'सर्भरसँग सम्पर्क हुन सकेन।');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(''), 1800);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-4 sm:px-5 py-3.5 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base truncate">
                AI कानुनी सहायक र ताजा वेब खोज (Gemini + Google Search)
              </h3>
              <p className="text-[11px] text-slate-300 truncate">
                नेपाल कानुन, जग्गा प्रशासन र पछिल्ला संशोधनहरूको बहु-चरणीय संवाद तथा स्रोत-प्रमाणित खोज
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <FontSizeControls variant="dark" />
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sub-tab Switcher */}
        <div className="px-4 sm:px-5 pt-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('chat')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 font-bold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'chat'
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <MessageSquareText className="w-3.5 h-3.5" />
              <span>AI कानुनी च्याट</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('search')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 font-bold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'search'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>ताजा कानुनी खोज (Google Search)</span>
            </button>
          </div>

          {activeContext && (activeContext.pdfName || activeContext.sectionLabel) && (
            <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-lg px-2.5 py-1 text-[11px] mb-1.5 max-w-full sm:max-w-sm">
              <BookOpen className="w-3 h-3 text-indigo-600 shrink-0" />
              <span className="truncate font-semibold">
                सन्दर्भ: {activeContext.sectionLabel || activeContext.pdfName}
              </span>
              {onClearContext && (
                <button
                  type="button"
                  onClick={onClearContext}
                  className="text-indigo-500 hover:text-indigo-900 ml-1 cursor-pointer"
                  title="सन्दर्भ हटाउनुहोस्"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {activeTab === 'chat' ? (
          <>
            {/* Model & Grounding Controls Bar */}
            <div className="px-4 sm:px-5 py-2.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-bold text-slate-600 mr-1">कार्य मोड:</span>
                {TASK_MODE_OPTIONS.map(opt => {
                  const selected = taskMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setTaskMode(opt.id)}
                      title={`${opt.modelName} — ${opt.desc}`}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold border transition-colors cursor-pointer ${
                        selected
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {opt.icon}
                      <span>{opt.label}</span>
                      <span className="hidden md:inline font-mono text-[10px] opacity-75">
                        ({opt.modelName.replace('gemini-', 'g')})
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-900 font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableSearchInChat}
                    onChange={e => setEnableSearchInChat(e.target.checked)}
                    className="rounded text-emerald-600"
                  />
                  <Globe className="w-3 h-3 text-emerald-700" />
                  <span>Google Search सहित</span>
                </label>

                <button
                  type="button"
                  onClick={handleClearChat}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 font-semibold cursor-pointer"
                  title="संवाद रिसेट गर्नुहोस्"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>नयाँ च्याट</span>
                </button>
              </div>
            </div>

            {/* Scrollable Chat Thread */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/70">
              {messages.map(msg => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isUser && (
                      <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                        <Bot className="w-4 h-4" />
                      </div>
                    )}

                    <div
                      className={`max-w-[88%] sm:max-w-[78%] rounded-2xl px-4 py-3 text-xs sm:text-sm shadow-2xs space-y-2.5 ${
                        isUser
                          ? 'bg-slate-900 text-white rounded-tr-sm'
                          : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm'
                      }`}
                    >
                      {isUser ? (
                        <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>
                      ) : (
                        <>
                          <div
                            className="prose prose-sm max-w-none prose-slate prose-headings:text-slate-900 prose-a:text-indigo-700 leading-relaxed"
                            dangerouslySetInnerHTML={{
                              __html: renderSafeMarkdownHtml(msg.text),
                            }}
                          />

                          {/* Verified Search Grounding Sources */}
                          {msg.groundingSources && msg.groundingSources.length > 0 && (
                            <div className="pt-2 border-t border-slate-100 space-y-1.5">
                              <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800">
                                <Globe className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Google Search बाट प्रमाणित स्रोतहरू:</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {msg.groundingSources.map((src, idx) => (
                                  <a
                                    key={`${src.uri}_${idx}`}
                                    href={src.uri}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 text-[11px] font-medium max-w-full"
                                  >
                                    <span className="truncate max-w-[220px]">{src.title}</span>
                                    <ExternalLink className="w-3 h-3 shrink-0 text-emerald-700" />
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Model metadata & copy button */}
                          <div className="pt-1 flex items-center justify-between gap-2 text-[10px] text-slate-400">
                            <div className="flex items-center gap-1.5 flex-wrap font-mono">
                              {msg.modelUsed && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                  {msg.modelUsed}
                                </span>
                              )}
                              {msg.usedFallback && msg.requestedModel && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                                  Auto-Fallback ({msg.requestedModel} अनुपलब्ध)
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopyText(msg.id, msg.text)}
                              className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 cursor-pointer"
                            >
                              {copiedId === msg.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span className="text-emerald-700">कपी भयो</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>कपी</span>
                                </>
                              )}
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    {isUser && (
                      <div className="w-8 h-8 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0 mt-0.5">
                        <UserIcon className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                );
              })}

              {messages.length <= 1 && !chatLoading && (
                <div className="pt-2 space-y-2">
                  <div className="text-[11px] font-bold text-slate-500">
                    सुझाव गरिएका प्रश्नहरू:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {CHAT_STARTER_PROMPTS.map((q, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => void handleSendMessage(q)}
                        className="text-left p-2.5 rounded-xl bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-xs text-slate-700 font-medium transition-colors cursor-pointer"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {chatLoading && (
                <div className="flex items-center gap-2.5 text-xs text-slate-600 bg-white border border-slate-200 rounded-xl px-4 py-3 w-fit">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                  <span>
                    Gemini ले जवाफ तयार गर्दैछ
                    {enableSearchInChat ? ' (Google Search सहित)' : ''}...
                  </span>
                </div>
              )}

              {chatError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{chatError}</span>
                </div>
              )}

              <div ref={threadEndRef} />
            </div>

            {/* Chat Input Bar */}
            <form
              onSubmit={e => {
                e.preventDefault();
                void handleSendMessage();
              }}
              className="p-3 sm:p-4 bg-white border-t border-slate-200 flex items-end gap-2"
            >
              <textarea
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleSendMessage();
                  }
                }}
                rows={2}
                placeholder="नेपालको कानुन, धारा, दफा वा जग्गा प्रशासन सम्बन्धी प्रश्न सोध्नुहोस्..."
                className="flex-1 resize-none rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
              />
              <button
                type="submit"
                disabled={chatLoading || !chatInput.trim()}
                className="px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 text-white font-bold text-xs sm:text-sm inline-flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">पठाउनुहोस्</span>
              </button>
            </form>
          </>
        ) : (
          /* Dedicated Google Search Grounding Tab */
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/70">
            <div className="bg-white rounded-xl border border-emerald-200 p-4 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-sm font-bold text-emerald-950">
                  <Globe className="w-4 h-4 text-emerald-600" />
                  <span>Google Search Grounding (gemini-4-hydrogen)</span>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Live Web Verification
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                नेपाल राजपत्र, नेपाल कानुन आयोग र सरकारी निकायहरूका ताजा संशोधन, अद्यावधिक सूचना वा फैसलाहरू वास्तविक वेब स्रोतसहित खोज्नुहोस्।
              </p>

              <form
                onSubmit={e => {
                  e.preventDefault();
                  void handleRunSearchGrounding();
                }}
                className="flex flex-col sm:flex-row gap-2"
              >
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="उदाहरण: जग्गा नापजाँच ऐन २०१९ पछिल्लो संशोधन कहिले भयो?"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={searchLoading || !searchQuery.trim()}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 text-white font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                >
                  {searchLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  <span>ताजा खोज गर्नुहोस्</span>
                </button>
              </form>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {SEARCH_PRESET_QUERIES.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => void handleRunSearchGrounding(preset)}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-900 border border-slate-200 hover:border-emerald-300 cursor-pointer transition-colors"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {searchError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{searchError}</span>
              </div>
            )}

            {searchLoading && (
              <div className="bg-white rounded-xl border border-slate-200 p-6 text-center space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin text-emerald-600 mx-auto" />
                <div className="text-xs sm:text-sm font-bold text-slate-800">
                  Google Search मार्फत आधिकारिक ताजा जानकारी खोजिँदैछ...
                </div>
              </div>
            )}

            {searchResult && !searchLoading && (
              <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 space-y-4 shadow-2xs">
                <div className="flex items-center justify-between gap-2 flex-wrap border-b border-slate-100 pb-2.5">
                  <div className="font-bold text-slate-900 text-xs sm:text-sm">
                    खोज नतिजा: {searchResult.query}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono">
                    <span className="px-2 py-0.5 rounded bg-slate-900 text-white">
                      {searchResult.modelUsed}
                    </span>
                    {searchResult.usedFallback && (
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900">
                        Fallback
                      </span>
                    )}
                  </div>
                </div>

                <div
                  className="prose prose-sm max-w-none prose-slate prose-a:text-emerald-700 leading-relaxed text-xs sm:text-sm"
                  dangerouslySetInnerHTML={{
                    __html: renderSafeMarkdownHtml(searchResult.answer),
                  }}
                />

                {searchResult.searchQueries.length > 0 && (
                  <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5">
                    <span className="font-bold">प्रयोग भएका वेब खोज:</span>
                    {searchResult.searchQueries.map((sq, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono"
                      >
                        {sq}
                      </span>
                    ))}
                  </div>
                )}

                {searchResult.groundingSources.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                      <Globe className="w-4 h-4 text-emerald-600" />
                      <span>प्रमाणित वेब स्रोत लिङ्कहरू ({searchResult.groundingSources.length})</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {searchResult.groundingSources.map((src, idx) => (
                        <a
                          key={`${src.uri}_${idx}`}
                          href={src.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-emerald-50/80 hover:bg-emerald-100 border border-emerald-200 text-emerald-950 text-xs font-semibold transition-colors"
                        >
                          <span className="truncate">{src.title}</span>
                          <ExternalLink className="w-3.5 h-3.5 shrink-0 text-emerald-700" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
