import { useState, useRef, useEffect } from 'react';
import { Send, ImagePlus, X, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Message {
  sender: 'user' | 'evolve';
  text: string;
  imageBase64?: string;
  isThinking?: boolean;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('evolve_chat_history');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse chat history");
        return [];
      }
    }
    return [];
  });
  const [inputValue, setInputValue] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  
  // Custom interactive features
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showPromptLibrary, setShowPromptLibrary] = useState(false);
  const [notebookMode, setNotebookMode] = useState(false);

  const chatAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persist messages to local storage
  useEffect(() => {
    localStorage.setItem('evolve_chat_history', JSON.stringify(messages));
  }, [messages]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSend = async () => {
    if ((!inputValue.trim() && !selectedImage) || isLoading) return;

    const userMessage: Message = {
      sender: 'user',
      text: inputValue.trim(),
      imageBase64: selectedImage || undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setSelectedImage(null);
    setIsLoading(true);

    try {
      const history = messages.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [
          ...(msg.imageBase64 ? [{
            inlineData: {
              mimeType: msg.imageBase64.match(/^data:(image\/[a-z]+);base64,/)?.[1] || 'image/jpeg',
              data: msg.imageBase64.split(',')[1] || msg.imageBase64
            }
          }] : []),
          { text: msg.text }
        ]
      }));

      const res = await fetch('/api/evolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: userMessage.text,
          imageBase64: userMessage.imageBase64,
          history,
          notebookMode // Dynamic systemInstruction
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to fetch from Evolve API');
      }

      const data = await res.json();
      setMessages((prev) => [...prev, { sender: 'evolve', text: data.text }]);
    } catch (error) {
      console.error(error);
      setMessages((prev) => [...prev, { sender: 'evolve', text: '*Error: Could not reach the Gemini AI Engine.*' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const fillPrompt = (prompt: string) => {
    setInputValue(prompt);
  };

  const clearChat = () => {
    setMessages([]);
    setSelectedImage(null);
    setInputValue('');
    setNotebookMode(false); // Reset notebook mode for normal chats
    setShowHistory(false);
  };

  // Helper Action: New Notebook Mode
  const startNewNotebook = () => {
    setMessages([]);
    setSelectedImage(null);
    setInputValue('');
    setNotebookMode(true);
    setShowHistory(false);
    
    // Add an initial greeting message in Notebook Mode!
    setMessages([
      {
        sender: 'evolve',
        text: "📝 **Welcome to Evolve Notebook Mode!**\n\nI am configured as your long-form document and research editor.\n\n*You are running in Pro Notebook Mode. Ask me to outline a topic, compose a script, or build extensive academic notes!*"
      }
    ]);
  };

  // Helper Action: Video Hub Simulation
  const handleVideosTap = () => {
    const videoMessage: Message = {
      sender: 'evolve',
      text: "🎥 **Welcome to the Evolve Video Hub!**\n\nHere are curated video guides to help you master AI engineering and UI design:\n\n1. 🛠️ **Build a Premium React Native Chat App**\n   *Duration: 12 mins* | [Watch Tutorial](https://www.youtube.com/watch?v=dQw4w9WgXcQ)\n\n2. 🔑 **Advanced Prompt Engineering with Gemini 2.5 Flash**\n   *Duration: 15 mins* | [Watch Tutorial](https://www.youtube.com/watch?v=dQw4w9WgXcQ)\n\n3. 🎨 **Designing Ambient Mesh UI Backgrounds**\n   *Duration: 8 mins* | [Watch Tutorial](https://www.youtube.com/watch?v=dQw4w9WgXcQ)\n\n*Tap any prompt below, or ask me for more specific educational resources!*"
    };
    setMessages([videoMessage]);
    setShowHistory(false);
  };

  return (
    <div className="flex h-screen h-[100dvh] overflow-hidden text-[#e3e3e3] evolve-ambient-mesh bg-[#0b0b0c] font-sans">
      
      {/* Main chat window container */}
      <div className="flex-1 flex flex-col relative h-full overflow-hidden">
        
        {/* Header with sidebar toggle */}
        <header className="flex-none px-6 py-4 flex items-center justify-between border-b border-white/5 bg-[#0b0b0c] z-10">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-white tracking-tight">Evolve</h1>
          </div>
          <div className="flex items-center gap-3">
            {messages.length > 0 && (
              <button 
                onClick={clearChat}
                className="text-[#808184] hover:text-[#e3e3e3] transition-colors p-2"
                title="Clear Chat"
              >
                <Trash2 size={20} />
              </button>
            )}
            {/* Sidebar toggle visible on mobile */}
            <button onClick={() => setShowHistory(true)} className="md:hidden text-[#808184] hover:text-white ml-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16" /></svg>
            </button>
          </div>
        </header>

        {/* Notebook Mode Banner */}
        {notebookMode && (
          <div className="bg-[#4285f4]/15 border-b border-[#4285f4]/25 py-2 text-center text-xs font-bold tracking-wide text-[#4285f4]">
            📝 Notebook Editor Mode Active
          </div>
        )}

        {/* Main Chat Area */}
        <main className="flex-1 overflow-y-auto px-4 md:px-16 lg:px-48 xl:px-64 pt-6 pb-40" ref={chatAreaRef}>
          
          {messages.length === 0 ? (
            <div className="flex flex-col h-[70vh] justify-center">
              <h2 className="text-4xl md:text-5xl font-medium text-white mb-2">Hello, Buddy.</h2>
              <h3 className="text-xl md:text-2xl text-[#808184] mb-12">How can Gemini AI help you today?</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button onClick={() => fillPrompt("Analyze this image and describe its key elements.")} className="evolve-liquid-glass p-5 rounded-2xl text-left hover:bg-[#282a2c]/40 transition-all hover:scale-[0.98] active:scale-[0.96]">
                  Image Analysis &rarr;
                </button>
                <button onClick={() => fillPrompt("Write a clean, responsive card component in React.")} className="evolve-liquid-glass p-5 rounded-2xl text-left hover:bg-[#282a2c]/40 transition-all hover:scale-[0.98] active:scale-[0.96]">
                  React Component &rarr;
                </button>
                <button onClick={() => fillPrompt("Help me brainstorm creative ideas for a personal project.")} className="evolve-liquid-glass p-5 rounded-2xl text-left hover:bg-[#282a2c]/40 transition-all hover:scale-[0.98] active:scale-[0.96]">
                  Creative Brainstorm &rarr;
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex gap-4 animate-in fade-in flex-row`}>
                  
                  {/* Avatar */}
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${msg.sender === 'user' ? 'bg-[#595b5a] text-white' : 'evolve-brand-gradient text-white'}`}>
                    {msg.sender === 'user' ? 'U' : 'G'}
                  </div>

                  {/* Message Content */}
                  <div className={`flex flex-col gap-3 max-w-[85%] items-start`}>
                    {msg.imageBase64 && (
                      <img src={msg.imageBase64} alt="Uploaded" className="max-w-[200px] md:max-w-xs rounded-xl shadow-md border border-white/5" />
                    )}
                    {msg.text && (
                      <div className="text-[15px] leading-relaxed markdown-body">
                        <ReactMarkdown>{msg.text}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-4 animate-in fade-in flex-row">
                   <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm evolve-brand-gradient text-white">G</div>
                   <div className="pt-2"><div className="pulse-loading" /></div>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Input Dock */}
        <div className="absolute bottom-0 left-0 right-0 p-4 md:px-16 lg:px-48 xl:px-64 pb-8 bg-gradient-to-t from-[#0b0b0c] via-[#0b0b0c]/90 to-transparent">
          <div className="max-w-4xl mx-auto w-full relative">
            
            {/* Image Preview inside Dock */}
            {selectedImage && (
              <div className="absolute -top-24 left-4 p-2 evolve-liquid-glass rounded-xl flex items-center gap-4">
                <img src={selectedImage} alt="Preview" className="h-16 w-16 object-cover rounded-md" />
                <button 
                  onClick={() => setSelectedImage(null)}
                  className="p-1 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                  title="Remove image"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            <div className="bg-[#1e1f20] border border-white/5 shadow-2xl rounded-[32px] pl-4 pr-2 py-2 flex items-center gap-2 focus-within:border-white/10 focus-within:bg-[#1e1f20]/80 transition-colors">
              
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-[#4285f4] hover:bg-white/5 rounded-full transition-colors shrink-0"
                title="Attach Photo"
              >
                <ImagePlus size={22} />
              </button>
              <input 
                type="file"
                ref={fileInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />

              <input 
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask Gemini anything, or attach an image..."
                className="flex-1 bg-transparent px-2 py-2 border-none outline-none text-base placeholder-[#808184]"
              />

              <button 
                onClick={handleSend}
                disabled={isLoading || (!inputValue.trim() && !selectedImage)}
                className="p-3 text-[#4285f4] bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-white/5 rounded-full transition-colors shrink-0 font-medium flex items-center justify-center"
              >
                 <Send size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Slide-out / Collapsible Sidebar History Drawer on the Right */}
      <aside className={`flex-none w-[280px] bg-black border-l border-white/5 flex flex-col justify-between p-5 z-20 transition-transform duration-300 md:translate-x-0 ${showHistory ? 'translate-x-0 fixed inset-y-0 right-0' : 'translate-x-full fixed inset-y-0 right-0 md:relative md:flex'}`}>
        
        {/* Top Content */}
        <div className="flex flex-col gap-6">
          
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-2xl font-medium text-white tracking-tight">Evolve</span>
            <button onClick={() => { setShowHistory(false); setIsSearching(false); setSearchQuery(''); }} className="md:hidden text-[#808184] hover:text-[#e3e3e3] p-1">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Drawer Search Input */}
          {isSearching && (
            <div className="flex items-center gap-2 bg-[#131314] border border-white/5 rounded-xl px-3 py-2 animate-in slide-in-from-top-2 duration-200">
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder-[#808184]"
                autoFocus
              />
              <button onClick={() => { setSearchQuery(''); setIsSearching(false); }} className="text-[#808184] hover:text-white">
                <X size={16} />
              </button>
            </div>
          )}

          {/* New Chat Pill Button */}
          <button onClick={clearChat} className="flex items-center gap-4 w-full bg-[#131314] hover:bg-[#1e1f20] border border-white/5 rounded-full py-3 px-5 text-left text-white transition-colors">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            <span className="font-medium text-[15px]">New chat</span>
          </button>

          {/* Nav List */}
          <nav className="flex flex-col gap-1 text-[15px] font-medium">
            <button onClick={() => setIsSearching(!isSearching)} className="flex items-center gap-4 hover:bg-white/5 rounded-xl py-3 px-3 transition-colors text-left w-full text-[#e3e3e3]">
              <svg className="w-5 h-5 text-[#e3e3e3]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <span>Search chats</span>
            </button>
            <button onClick={handleVideosTap} className="flex items-center gap-4 hover:bg-white/5 rounded-xl py-3 px-3 transition-colors text-left w-full text-[#e3e3e3]">
              <svg className="w-5 h-5 text-[#e3e3e3]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              <span>Videos</span>
            </button>
            <button onClick={() => setShowPromptLibrary(true)} className="flex items-center gap-4 hover:bg-white/5 rounded-xl py-3 px-3 transition-colors text-left w-full text-[#e3e3e3]">
              <svg className="w-5 h-5 text-[#e3e3e3]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
              <span>Library</span>
            </button>
          </nav>

          {/* Notebooks Section */}
          <div className="flex flex-col gap-1">
            <span className="text-[12px] font-bold text-[#808184] uppercase tracking-wider px-3 mt-4 mb-2">Notebooks</span>
            <button onClick={startNewNotebook} className="flex items-center gap-4 hover:bg-white/5 rounded-xl py-3 px-3 transition-colors text-left w-full text-[#e3e3e3] text-[15px] font-medium">
              <svg className="w-5 h-5 text-[#e3e3e3]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              <span>New notebook</span>
            </button>
          </div>

          {/* Recent Section */}
          <div className="flex flex-col gap-1">
            <span className="text-[12px] font-bold text-[#808184] uppercase tracking-wider px-3 mt-4 mb-2">Recent</span>
            
            {/* Skeleton Loading Bars from your Screenshot! */}
            <div className="flex flex-col gap-4 px-3 mt-2">
              <div className="h-[14px] skeleton-pulse rounded-full w-[85%]" />
              <div className="h-[14px] skeleton-pulse rounded-full w-[55%]" />
              <div className="h-[14px] skeleton-pulse rounded-full w-[70%]" />
            </div>
          </div>

        </div>

      </aside>

      {/* 7. Prompt Library Modal Overlay */}
      {showPromptLibrary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#131314] border border-white/10 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
              <h3 className="text-xl font-bold text-white">Prompt Library</h3>
              <button onClick={() => setShowPromptLibrary(false)} className="text-[#808184] hover:text-white p-1 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1">
              {[
                { category: 'Coding & Dev', prompt: 'Write a clean, responsive card component in React.' },
                { category: 'Coding & Dev', prompt: 'Create a beautiful CSS mesh gradient animation.' },
                { category: 'Creative & Writing', prompt: 'Help me brainstorm creative ideas for a personal project.' },
                { category: 'Creative & Writing', prompt: 'Write an engaging storytelling intro about space exploration.' },
                { category: 'Analysis & Reviews', prompt: 'Analyze this image and describe its key elements.' },
                { category: 'Analysis & Reviews', prompt: 'Review my code for performance optimization bottlenecks.' },
              ].map((item, index) => (
                <button 
                  key={index}
                  onClick={() => {
                    setInputValue(item.prompt);
                    setShowPromptLibrary(false);
                    setShowHistory(false);
                  }}
                  className="bg-[#1e1f20] hover:bg-[#282a2c] border border-white/5 rounded-xl p-4 text-left transition-all hover:scale-[0.99] active:scale-[0.98]"
                >
                  <span className="block text-[11px] text-[#4285f4] font-bold uppercase tracking-wider mb-1">{item.category}</span>
                  <span className="text-sm text-[#e3e3e3] leading-relaxed">{item.prompt}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
