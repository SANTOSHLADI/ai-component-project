// src/app/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ComponentPreview from '@/components/ComponentPreview';
import JSZip from 'jszip';

// --- TYPE DEFINITIONS ---
interface GeneratedCode { jsx: string; css: string; }
interface Message { sender: 'user' | 'ai'; text: string; }
interface Session { _id: string; lastUpdatedAt: string; }

// --- CHILD COMPONENTS (Now properly formatted) ---

function ChatPanel({ messages, onSendMessage }: { messages: Message[]; onSendMessage: (prompt: string) => void; }) {
  const [prompt, setPrompt] = useState('');
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onSendMessage(prompt);
      setPrompt('');
    }
  };
  return (
    <div className="flex flex-col h-full bg-gray-800 text-white">
      <div className="flex-1 p-4 overflow-y-auto">
        {messages.length === 0 ? (
          <p className="text-sm text-gray-400">Start by describing the component you want to build.</p>
        ) : (
          messages.map((msg, index) => (
            <div key={index} className={`mb-3 p-2 rounded-lg ${msg.sender === 'user' ? 'bg-blue-600 self-end' : 'bg-gray-700 self-start'}`}>
              <p className="text-sm">{msg.text}</p>
            </div>
          ))
        )}
      </div>
      <div className="p-4 border-t border-gray-700">
        <form onSubmit={handleFormSubmit}>
          <input
            type="text"
            placeholder="e.g., a blue login button"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full px-3 py-2 bg-gray-900 rounded-lg focus:outline-none"
          />
        </form>
      </div>
    </div>
  );
}

function CodeDisplay({ code }: { code: GeneratedCode | null }) {
  const [activeTab, setActiveTab] = useState<'jsx' | 'css'>('jsx');
  const [copySuccess, setCopySuccess] = useState('');

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopySuccess('Copied!');
        setTimeout(() => setCopySuccess(''), 2000);
      },
      () => {
        setCopySuccess('Failed to copy');
        setTimeout(() => setCopySuccess(''), 2000);
      }
    );
  };

  const handleDownload = () => {
    if (!code) return;
    const zip = new JSZip();
    const folder = zip.folder('component');
    folder!.file('Component.jsx', code.jsx);
    folder!.file('style.css', code.css);
    zip.generateAsync({ type: 'blob' }).then((content) => {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = 'component.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  };

  if (!code) {
    return (
      <div className="bg-gray-900 text-white p-4 rounded-lg h-full flex items-center justify-center">
        <p className="text-gray-400">Generated code will appear here.</p>
      </div>
    );
  }

  const currentCode = activeTab === 'jsx' ? code.jsx : code.css;

  return (
    <div className="bg-gray-900 text-white rounded-lg h-full flex flex-col">
      <div className="flex items-center justify-between border-b border-gray-700">
        <div className="flex">
          <button onClick={() => setActiveTab('jsx')} className={`px-4 py-2 ${activeTab === 'jsx' ? 'bg-gray-700' : ''}`}>JSX</button>
          <button onClick={() => setActiveTab('css')} className={`px-4 py-2 ${activeTab === 'css' ? 'bg-gray-700' : ''}`}>CSS</button>
        </div>
        <div className="flex items-center gap-2 pr-4">
          {copySuccess && <span className="text-sm text-green-400">{copySuccess}</span>}
          <button onClick={() => handleCopy(currentCode)} className="text-sm px-3 py-1 bg-gray-600 rounded hover:bg-gray-500">Copy</button>
          <button onClick={handleDownload} className="text-sm px-3 py-1 bg-blue-600 rounded hover:bg-blue-500">Download .zip</button>
        </div>
      </div>
      <pre className="text-sm p-4 overflow-y-auto flex-1">
        <code>{currentCode}</code>
      </pre>
    </div>
  );
}

function SessionManager({ sessions, onLoad, onNew, onLogout }: { sessions: Session[], onLoad: (id: string) => void, onNew: () => void, onLogout: () => void }) {
  return (
    <div className="p-4 bg-gray-700 text-white">
      <h2 className="text-lg font-bold mb-2">Sessions</h2>
      <button onClick={onNew} className="w-full mb-4 px-4 py-2 bg-green-600 rounded hover:bg-green-500 text-sm">+ New Session</button>
      <div className="max-h-48 overflow-y-auto">
        {sessions.map(session => (
          <div key={session._id} onClick={() => onLoad(session._id)} className="p-2 mb-2 bg-gray-600 rounded cursor-pointer hover:bg-gray-500">
            <p className="text-xs">Session from:</p>
            <p className="text-sm font-semibold">{new Date(session.lastUpdatedAt).toLocaleString()}</p>
          </div>
        ))}
      </div>
      <button onClick={onLogout} className="w-full mt-4 px-4 py-2 bg-red-600 rounded hover:bg-red-500 text-sm">Logout</button>
    </div>
  );
}

// --- MAIN PAGE COMPONENT ---
export default function Home() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [generatedCode, setGeneratedCode] = useState<GeneratedCode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  const fetchSessions = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    try {
      const res = await fetch(`${API_URL}/api/sessions`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to fetch sessions');
      const data = await res.json();
      setSessions(data);
    } catch (error) { console.error(error); }
  }, [router, API_URL]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const saveSession = useCallback(async (msgs: Message[], code: GeneratedCode | null) => {
    const token = localStorage.getItem('token');
    if (!token || !msgs.length) return;
    try {
      const response = await fetch(`${API_URL}/api/sessions/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ messages: msgs, generatedCode: code, sessionId: sessionId }),
      });
      if (!response.ok) throw new Error('Failed to save session');
      const data = await response.json();
      if (data.session?._id && !sessionId) { setSessionId(data.session._id); }
      fetchSessions();
    } catch (error) { console.error(error); }
  }, [sessionId, fetchSessions, API_URL]);

  const handleSendMessage = async (prompt: string) => {
    setIsLoading(true);
    const newMessages: Message[] = [...messages, { sender: 'user', text: prompt }];
    setMessages(newMessages);

    try {
      const response = await fetch(`${API_URL}/api/generate/component`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, currentJsx: generatedCode?.jsx, currentCss: generatedCode?.css }),
      });
      if (!response.ok) throw new Error('Failed to fetch from the API');
      const data: GeneratedCode = await response.json();
      setGeneratedCode(data);
      const finalMessages = [...newMessages, { sender: 'ai', text: "Here is the code for your component." }];
      setMessages(finalMessages);
      await saveSession(finalMessages, data);
    } catch (error) {
      console.error(error);
      const errorMessages = [...newMessages, { sender: 'ai', text: "Sorry, something went wrong. Please try again." }];
      setMessages(errorMessages);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadSession = async (id: string) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_URL}/api/sessions/${id}`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to load session');
      const data = await res.json();
      setSessionId(data._id);
      setMessages(data.messages);
      setGeneratedCode(data.generatedCode);
    } catch (error) { console.error(error); }
  };

  const handleNewSession = () => {
    setSessionId(null);
    setMessages([]);
    setGeneratedCode(null);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/login');
  };

  return (
    <div className="flex h-screen bg-gray-200">
      <aside className="w-1/3 max-w-sm bg-gray-800 flex flex-col">
        <SessionManager sessions={sessions} onLoad={handleLoadSession} onNew={handleNewSession} onLogout={handleLogout} />
        <div className="flex-1 flex flex-col min-h-0">
          <ChatPanel messages={messages} onSendMessage={handleSendMessage} />
        </div>
      </aside>
      <main className="flex-1 flex flex-col p-4 md:p-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-800 mb-4">
          AI Component Generator
        </h1>
        <div className="flex-1 bg-white border border-gray-300 rounded-lg mb-6 overflow-hidden">
          {isLoading && !generatedCode ? (<div className="w-full h-full flex items-center justify-center"><p className="text-gray-500">Generating component...</p></div>) : (<ComponentPreview code={generatedCode} />)}
        </div>
        <div className="h-1/3"><CodeDisplay code={generatedCode} /></div>
      </main>
    </div>
  );
}
