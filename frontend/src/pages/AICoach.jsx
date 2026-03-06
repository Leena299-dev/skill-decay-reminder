import { useState, useEffect, useRef, useCallback } from 'react';
import { getSkills, postCoachMessage } from '../services/api';
import './AICoach.css';

const SUGGESTED_QUESTIONS = [
  "Why am I struggling with my skills?",
  "What should I focus on this week?",
  "Create me a study plan",
  "How can I improve my scores?",
  "Which skill needs the most attention?",
  "How does the forgetting curve affect me?",
];

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

/**
 * Splits message text and wraps any skill name occurrences in clickable buttons.
 * Returns an array of strings + React elements suitable for rendering.
 */
function renderWithSkillLinks(text, skills, onSkillClick) {
  if (!text || typeof text !== 'string') return text ?? '';
  if (!skills || skills.length === 0) return [text];

  const sorted = [...skills].sort((a, b) => b.skillName.length - a.skillName.length);
  const escaped = sorted.map(s => s.skillName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');

  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const skill = sorted.find(s => s.skillName.toLowerCase() === match[0].toLowerCase());
    if (skill) {
      parts.push(
        <button
          key={`skill-${match.index}`}
          className="coach-skill-link"
          onClick={() => onSkillClick(skill.skillId)}
          title={`Practice ${skill.skillName}`}
        >
          {match[0]}
        </button>
      );
    } else {
      parts.push(match[0]);
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length > 0 ? parts : [text];
}

function TypingDots() {
  return (
    <div className="coach-typing">
      <span /><span /><span />
    </div>
  );
}

function AICoach({ userId, onNavigate, onPracticeSkill }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  // Conversation history sent to Lambda: [{ role, content }]
  const [convHistory, setConvHistory] = useState([]);
  const [skills, setSkills] = useState([]);
  const [ratings, setRatings] = useState({});    // msgId → 'up' | 'down'
  const [copied, setCopied] = useState(null);    // msgId being shown as copied

  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const copyTimers = useRef({});

  // Load skills for clickable skill links
  useEffect(() => {
    getSkills(userId)
      .then(data => setSkills(data.skills || []))
      .catch(() => {});
  }, [userId]);

  // Auto-scroll on new messages or typing indicator
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, [input]);

  const handleSend = useCallback(async (text) => {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;

    const userMsg = {
      id: `${Date.now()}-user`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Build updated history before the call so the Lambda gets the full context
    const historyWithUser = [...convHistory, { role: 'user', content: trimmed }];

    try {
      const data = await postCoachMessage(userId, trimmed, convHistory);
      const aiMsg = {
        id: `${Date.now()}-ai`,
        role: 'assistant',
        content: data.response,
        timestamp: data.timestamp || new Date().toISOString(),
      };
      setMessages(prev => [...prev, aiMsg]);
      // Keep last 20 turns in history (Lambda trims to 10 on its side too)
      setConvHistory([...historyWithUser, { role: 'assistant', content: data.response }].slice(-20));
    } catch {
      const errMsg = {
        id: `${Date.now()}-err`,
        role: 'assistant',
        content: "Sorry, I couldn't reach the AI coach right now. Please try again in a moment.",
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsTyping(false);
    }
  }, [isTyping, convHistory, userId]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  const handleClear = () => {
    setMessages([]);
    setConvHistory([]);
    setRatings({});
  };

  const handleCopy = (msg) => {
    navigator.clipboard.writeText(msg.content).then(() => {
      clearTimeout(copyTimers.current[msg.id]);
      setCopied(msg.id);
      copyTimers.current[msg.id] = setTimeout(() => setCopied(null), 2000);
    }).catch(() => {});
  };

  const handleRate = (msgId, rating) => {
    setRatings(prev => ({ ...prev, [msgId]: prev[msgId] === rating ? null : rating }));
  };

  const handleSkillClick = (skillId) => {
    onPracticeSkill(skillId);
    onNavigate('dashboard');
  };

  return (
    <div className="coach-page">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="coach-header">
        <div className="coach-header-left">
          <span className="coach-header-icon">🤖</span>
          <div>
            <h1 className="coach-header-title">AI Learning Coach</h1>
            <p className="coach-header-sub">Your personal learning assistant</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button className="coach-clear-btn" onClick={handleClear} title="Clear conversation">
            Clear chat
          </button>
        )}
      </div>

      {/* ── Messages ───────────────────────────────────────────── */}
      <div className="coach-messages">
        {/* Empty state */}
        {messages.length === 0 && !isTyping && (
          <div className="coach-empty">
            <span className="coach-empty-icon">🤖</span>
            <h2 className="coach-empty-title">Hi! I&apos;m your AI Learning Coach.</h2>
            <p className="coach-empty-sub">
              I know your skills and progress. Ask me anything about your learning journey!
            </p>
            <div className="coach-chips">
              {SUGGESTED_QUESTIONS.map(q => (
                <button key={q} className="coach-chip" onClick={() => handleSend(q)}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        {(messages || []).map(msg => (
          <div
            key={msg.id}
            className={`coach-msg coach-msg--${msg.role === 'user' ? 'user' : 'ai'}`}
          >
            {msg.role === 'assistant' && (
              <div className="coach-avatar">🤖</div>
            )}

            <div className={`coach-bubble coach-bubble--${msg.role === 'user' ? 'user' : 'ai'}`}>
              <div className="coach-text">
                {msg.role === 'assistant'
                  ? renderWithSkillLinks(msg.content ?? '', skills ?? [], handleSkillClick)
                  : (msg.content ?? '')
                }
              </div>

              <div className="coach-meta">
                <span className="coach-time">{formatTime(msg.timestamp)}</span>

                {msg.role === 'assistant' && (
                  <div className="coach-actions">
                    <button
                      className="coach-action-btn"
                      onClick={() => handleCopy(msg)}
                      title="Copy message"
                    >
                      {copied === msg.id ? '✓' : '⧉'}
                    </button>
                    <button
                      className={`coach-action-btn${ratings[msg.id] === 'up' ? ' coach-action-btn--active' : ''}`}
                      onClick={() => handleRate(msg.id, 'up')}
                      title="Helpful"
                    >
                      👍
                    </button>
                    <button
                      className={`coach-action-btn${ratings[msg.id] === 'down' ? ' coach-action-btn--active' : ''}`}
                      onClick={() => handleRate(msg.id, 'down')}
                      title="Not helpful"
                    >
                      👎
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="coach-msg coach-msg--ai">
            <div className="coach-avatar">🤖</div>
            <div className="coach-bubble coach-bubble--ai">
              <TypingDots />
            </div>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>

      {/* ── Input area ─────────────────────────────────────────── */}
      <div className="coach-input-area">
        <textarea
          ref={textareaRef}
          className="coach-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask your AI coach anything… (Enter to send, Shift+Enter for new line)"
          rows={1}
          disabled={isTyping}
        />
        <button
          className="coach-send-btn"
          onClick={() => handleSend(input)}
          disabled={!input.trim() || isTyping}
          aria-label="Send message"
        >
          ➤
        </button>
      </div>
    </div>
  );
}

export default AICoach;
