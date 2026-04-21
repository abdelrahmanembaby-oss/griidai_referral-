import { useState } from 'react';
import { Send, Map, MapPinOff } from 'lucide-react';
import { MapCurtain } from '../components/MapCurtain';
import { ShpUploadPanel } from '../components/ShpUploadPanel';
import type { VectorLayer } from '../components/MapPanel';

type Msg = { id: string; role: 'user' | 'ai'; text: string; ts: string };

export function ChatHomePage() {
  const [value, setValue] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [activeLayers, setActiveLayers] = useState<VectorLayer[]>([]);

  const canSend = value.trim().length > 0;
  const isEmpty = messages.length === 0;

  const send = () => {
    if (!canSend) return;
    const now = new Date();
    const userMsg: Msg = {
      id: `u_${now.getTime()}`,
      role: 'user',
      text: value.trim(),
      ts: now.toLocaleTimeString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setValue('');

    const aiNow = new Date(now.getTime() + 300);
    const aiMsg: Msg = {
      id: `a_${aiNow.getTime()}`,
      role: 'ai',
      text: `Got it! I'll process your spatial data request. You can also invite friends via the Refer & Earn button to unlock Pro features.`,
      ts: aiNow.toLocaleTimeString(),
    };
    setTimeout(() => setMessages((prev) => [...prev, aiMsg]), 400);
  };

  return (
    <div className="chat-main">
      {/* Top bar with Show/Hide Map */}
      <div className="chat-topbar">
        <button
          id="toggle-map-btn"
          className={`chat-show-map-btn ${isMapOpen ? 'chat-show-map-btn--active' : ''}`}
          onClick={() => setIsMapOpen((prev) => !prev)}
        >
          {isMapOpen ? (
            <>
              <MapPinOff size={15} />
              Hide Map
            </>
          ) : (
            <>
              <Map size={15} />
              Show Map
            </>
          )}
        </button>
      </div>

      {/* Map + Upload Panel Area */}
      <div className={`map-area-container ${isMapOpen ? 'map-area-container--open' : ''}`}>
        <div style={{ flex: 1, position: 'relative' }}>
          <MapCurtain isOpen={isMapOpen} layers={activeLayers} />
        </div>
        
        {/* Upload Panel slides in from right when map is open */}
        <div className={`upload-panel-container ${isMapOpen ? 'upload-panel-container--open' : ''}`}>
          <ShpUploadPanel 
            onLayerLoaded={(layer) => setActiveLayers(prev => [...prev, layer])}
            onLayerRemoved={(id) => setActiveLayers(prev => prev.filter(l => l.id !== id))}
            activeLayers={activeLayers}
          />
        </div>
      </div>

      {/* Messages area or empty state */}
      <div className="chat-messages-area">
        {isEmpty ? (
          <div className="chat-empty-state">
            {/* Globe/Brain icon */}
            <div className="chat-globe-icon">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="20" stroke="#2b8a8a" strokeWidth="2.5" opacity="0.3" />
                <circle cx="24" cy="24" r="14" stroke="#2b8a8a" strokeWidth="2" />
                <path d="M10 24h28M24 4c4 5 6.5 12 6.5 20s-2.5 15-6.5 20c-4-5-6.5-12-6.5-20s2.5-15 6.5-20z" stroke="#2b8a8a" strokeWidth="1.8" fill="none" />
                <ellipse cx="24" cy="24" rx="20" ry="8" stroke="#2b8a8a" strokeWidth="1.5" opacity="0.5" />
              </svg>
            </div>
            <h1 className="chat-empty-title">Simplifying Spatial Engineering</h1>
            <p className="chat-empty-subtitle">Describe a spatial task to get started.</p>
          </div>
        ) : (
          <div className="chat-messages-list">
            {messages.map((m) => (
              <div key={m.id} className={`chat-msg ${m.role === 'user' ? 'chat-msg--user' : 'chat-msg--ai'}`}>
                <div className={`chat-msg-bubble ${m.role === 'user' ? 'chat-msg-bubble--user' : 'chat-msg-bubble--ai'}`}>
                  <div className="chat-msg-text">{m.text}</div>
                  <div className={`chat-msg-ts ${m.role === 'user' ? 'chat-msg-ts--user' : ''}`}>{m.ts}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom input bar */}
      <div className="chat-input-area">
        <div className="chat-input-container">
          <button className="chat-behind-prompt-btn">
            <span className="chat-behind-dot" />
            Behind the Prompt
          </button>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
            placeholder="Enter your prompt (type 'file:', 'workflow:' or 'tool:' to search)"
            className="chat-input"
          />
          <button
            onClick={send}
            disabled={!canSend}
            className="chat-send-btn"
          >
            <Send size={18} />
          </button>
        </div>
        <p className="chat-disclaimer">GriidAI can make mistakes. Consider checking important information.</p>
      </div>
    </div>
  );
}
