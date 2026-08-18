'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowUp, Bot, Sparkles, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { AI_ASSISTANT, CRISIS_SUPPORT } from '@/config/business';
import { cn } from '@/lib/utils';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  links?: { href: string; label: string }[];
  crisis?: boolean;
}

const SUGGESTIONS = [
  'Which service is right for me?',
  'How much does a session cost?',
  'Do you take medical aid?',
  'What happens in a first session?',
  'Where are you based?',
];

/**
 * Floating wellness assistant.
 *
 * It identifies itself as AI on every open, answers from the practice's own
 * published information, and routes anything that sounds like distress to real
 * support rather than attempting to help. It never diagnoses or advises.
 */
export function AssistantLauncher() {
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState('');
  const [thinking, setThinking] = React.useState(false);
  const reduced = useReducedMotion();
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const counter = React.useRef(0);

  /**
   * The home page opens on a full-screen photograph whose own call to action
   * is the point of the page. A floating button parked over it both competes
   * with that and physically overlaps the row of detail pills on a phone, so
   * the launcher waits until the hero has been scrolled past. Everywhere else
   * it is present immediately.
   */
  const pathname = usePathname();
  const [pastHero, setPastHero] = React.useState(true);

  React.useEffect(() => {
    if (pathname !== '/') {
      setPastHero(true);
      return;
    }
    const onScroll = () => setPastHero(window.scrollY > window.innerHeight * 0.6);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [pathname]);

  React.useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([
        {
          id: ++counter.current,
          role: 'assistant',
          text: `Hello — I'm the Be Whole Care ${AI_ASSISTANT.name}. ${AI_ASSISTANT.disclaimer}\n\nWhat would you like to know?`,
        },
      ]);
    }
  }, [open, messages.length]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, thinking]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;

    setMessages((m) => [...m, { id: ++counter.current, role: 'user', text: trimmed }]);
    setInput('');
    setThinking(true);

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      });
      const data = (await res.json()) as {
        reply: string;
        links?: { href: string; label: string }[];
        crisis?: boolean;
      };
      setMessages((m) => [
        ...m,
        {
          id: ++counter.current,
          role: 'assistant',
          text: data.reply,
          links: data.links,
          crisis: data.crisis,
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          id: ++counter.current,
          role: 'assistant',
          text: "I couldn't reach our system just then. You can always call or WhatsApp 063 883 7170, or book directly from the booking page.",
          links: [{ href: '/book', label: 'Book an appointment' }],
        },
      ]);
    } finally {
      setThinking(false);
    }
  }

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        initial={reduced ? false : { opacity: 0, scale: 0.8 }}
        animate={{
          opacity: pastHero ? 1 : 0,
          scale: pastHero ? 1 : 0.8,
          pointerEvents: pastHero ? 'auto' : 'none',
        }}
        transition={{ delay: pastHero ? 0 : 0, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        whileHover={reduced ? undefined : { y: -2 }}
        aria-hidden={!pastHero}
        tabIndex={pastHero ? 0 : -1}
        className={cn(
          // Sits above the WhatsApp button (bottom-24), which in turn clears
          // the dock. See the note in components/site/whatsapp.tsx.
          'no-print fixed bottom-44 right-4 z-[75] flex h-14 items-center gap-2.5 rounded-full pl-4 pr-5 shadow-float sm:right-5',
          'transition-colors duration-250 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 focus-visible:ring-offset-2',
          open ? 'bg-white text-ink border border-line' : 'bg-forest-800 text-cream-100',
        )}
        aria-label={open ? 'Close assistant' : 'Open the Be Whole Care assistant'}
        aria-expanded={open}
      >
        {open ? <X className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
        <span className="hidden text-sm font-medium sm:inline">
          {open ? 'Close' : 'Ask a question'}
        </span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            // Clears the launcher itself, which now sits at bottom-44.
            className="no-print fixed bottom-[15.5rem] right-4 z-[75] flex h-[min(26rem,56vh)] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-float sm:right-5"
            role="dialog"
            aria-label="Be Whole Care assistant"
          >
            <div className="flex items-center gap-3 border-b border-line bg-cream-50 dark:bg-canvas px-5 py-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-forest-800 text-cream-100">
                <Bot className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{AI_ASSISTANT.name}</p>
                <p className="text-xs text-ink-faint">AI assistant · not a counsellor</p>
              </div>
            </div>

            <div ref={scrollRef} className="scrollbar-slim flex-1 space-y-3 overflow-y-auto p-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-3 text-sm leading-relaxed',
                      message.role === 'user'
                        ? 'rounded-br-md bg-forest-800 text-cream-100'
                        : message.crisis
                          ? 'rounded-bl-md border border-state-warning/30 bg-state-warningSoft text-ink'
                          : 'rounded-bl-md bg-cream-100 dark:bg-card text-ink',
                    )}
                  >
                    {message.text}
                    {message.crisis && (
                      <ul className="mt-3 space-y-1 border-t border-state-warning/25 pt-3">
                        {CRISIS_SUPPORT.contacts.map((c) => (
                          <li key={c.value} className="flex justify-between gap-3 text-xs">
                            <span className="text-ink-soft">{c.label}</span>
                            <a href={c.href} className="tabular font-medium text-ink underline">
                              {c.value}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                    {message.links && message.links.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {message.links.map((link) => (
                          <Link
                            key={link.href}
                            href={link.href}
                            onClick={() => setOpen(false)}
                            className="rounded-full border border-line-strong bg-white px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-forest-300"
                          >
                            {link.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {thinking && (
                <div className="flex justify-start">
                  <div className="flex gap-1.5 rounded-2xl rounded-bl-md bg-cream-100 dark:bg-card px-4 py-4">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-ink-faint"
                        animate={reduced ? undefined : { opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.15 }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {messages.length <= 1 && !thinking && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="rounded-full border border-line bg-white px-3 py-1.5 text-xs text-ink-muted transition-colors hover:border-forest-300 hover:text-ink"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-center gap-2 border-t border-line p-3"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about services, booking or fees…"
                aria-label="Message"
                className="h-11 flex-1 rounded-full border border-line bg-cream-50 dark:bg-canvas px-4 text-sm text-ink placeholder:text-ink-faint focus:border-forest-400 focus:outline-none"
              />
              <Button type="submit" size="icon" disabled={!input.trim() || thinking} aria-label="Send">
                <ArrowUp className="h-4 w-4" />
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
