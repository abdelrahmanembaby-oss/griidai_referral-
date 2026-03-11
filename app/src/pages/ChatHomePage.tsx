import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

type Msg = { id: string; role: 'user' | 'ai'; text: string; ts: string };

export function ChatHomePage() {
  const [value, setValue] = useState('');
  const [messages, setMessages] = useState<Msg[]>(() => [
    {
      id: 'm1',
      role: 'ai',
      text: 'Hi! I’m Griid AI. Ask me anything—or invite friends to earn rewards.',
      ts: new Date().toLocaleTimeString(),
    },
  ]);

  const canSend = value.trim().length > 0;

  const header = useMemo(
    () => (
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-gray-700">Invite your friend</div>
          <div className="text-xs text-gray-500">Earn tiered rewards (1 / 3 / 5 / 10 referrals)</div>
        </div>
        <Button asChild className="bg-gradient-to-r from-[#7c5cff] to-[#7337ff] text-white shadow-lg shadow-purple-500/25">
          <Link to="/referral">
            <Sparkles className="h-4 w-4 mr-2" />
            Referral
          </Link>
        </Button>
      </div>
    ),
    []
  );

  const send = () => {
    if (!canSend) return;
    const now = new Date();
    const userMsg: Msg = { id: `u_${now.getTime()}`, role: 'user', text: value.trim(), ts: now.toLocaleTimeString() };
    setMessages((prev) => [...prev, userMsg]);
    setValue('');

    const aiNow = new Date(now.getTime() + 300);
    const aiMsg: Msg = {
      id: `a_${aiNow.getTime()}`,
      role: 'ai',
      text: 'Got it. If you want rewards, open the Referral tab above and share your link.',
      ts: aiNow.toLocaleTimeString(),
    };
    setTimeout(() => setMessages((prev) => [...prev, aiMsg]), 350);
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="rounded-2xl border bg-white shadow-sm">
        <div className="border-b p-4">{header}</div>

        <div className="h-[70vh] overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-white to-purple-50/40">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                  m.role === 'user'
                    ? 'bg-gradient-to-r from-[#7c5cff] to-[#7337ff] text-white'
                    : 'bg-white border text-gray-900'
                }`}
              >
                <div className="whitespace-pre-wrap">{m.text}</div>
                <div className={`mt-1 text-[11px] ${m.role === 'user' ? 'text-white/70' : 'text-gray-400'}`}>
                  {m.ts}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t p-3">
          <div className="flex gap-2">
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') send();
              }}
              placeholder="Type your message…"
              className="h-12"
            />
            <Button
              onClick={send}
              disabled={!canSend}
              className="h-12 bg-gradient-to-r from-[#7c5cff] to-[#7337ff] text-white"
            >
              <Send className="h-4 w-4 mr-2" />
              Send
            </Button>
          </div>
          <div className="mt-2 text-xs text-gray-500">This is a UI mock chat; backend AI not wired yet.</div>
        </div>
      </div>
    </div>
  );
}

