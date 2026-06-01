import React, { useState, useRef, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  Image, 
  KeyboardAvoidingView, 
  Platform, 
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Keyboard,
  Animated,
  Easing,
  Dimensions
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || "";
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Message {
  id: string;
  sender: 'user' | 'gemini';
  text: string;
  imageBase64?: string;
}

interface SavedChat {
  id: string;
  title: string;
  timestamp: string; // Date & Time
  messages: Message[];
}

// Simple Markdown Bold / Italic / Code parser
const parseText = (text: string) => {
  if (!text) return <Text></Text>;
  
  const tokens = [];
  let remaining = text;
  const regex = /(\*\*|__)(.*?)\1|(\*|_)(.*?)\3|(`)(.*?)\5|\n/g;
  let match;
  let lastIndex = 0;
  let key = 0;

  while ((match = regex.exec(remaining)) !== null) {
    const matchIndex = match.index;
    if (matchIndex > lastIndex) {
      tokens.push(
        <Text key={`text-${key++}`} style={styles.normalText}>
          {remaining.substring(lastIndex, matchIndex)}
        </Text>
      );
    }
    
    if (match[1]) { // Bold
      tokens.push(
        <Text key={`bold-${key++}`} style={styles.boldText}>
          {match[2]}
        </Text>
      );
    } else if (match[3]) { // Italic
      tokens.push(
        <Text key={`italic-${key++}`} style={styles.italicText}>
          {match[4]}
        </Text>
      );
    } else if (match[5]) { // Code
      tokens.push(
        <View key={`code-bg-${key++}`} style={styles.codeContainer}>
          <Text style={styles.codeText}>{match[6]}</Text>
        </View>
      );
    } else { // Newline
      tokens.push(<Text key={`nl-${key++}`}>{'\n'}</Text>);
    }
    lastIndex = regex.lastIndex;
  }
  
  if (lastIndex < remaining.length) {
    tokens.push(
      <Text key={`text-${key++}`} style={styles.normalText}>
        {remaining.substring(lastIndex)}
      </Text>
    );
  }
  
  return <Text style={styles.messageText}>{tokens}</Text>;
};

// Shape Icons
const SendIcon = () => (
  <View style={styles.sendIconContainer}>
    <View style={styles.sendIconArrow} />
  </View>
);

const TrashIcon = () => (
  <View style={styles.trashContainer}>
    <View style={styles.trashLid} />
    <View style={styles.trashBody} />
  </View>
);

const ImageIcon = () => (
  <View style={styles.imageIconContainer}>
    <View style={styles.imageIconOuter} />
    <View style={styles.imageIconInner} />
  </View>
);

const CloseIcon = () => (
  <View style={styles.closeIconContainer}>
    <View style={[styles.closeIconLine, { transform: [{ rotate: '45deg' }] }]} />
    <View style={[styles.closeIconLine, { transform: [{ rotate: '-45deg' }] }]} />
  </View>
);

const HistoryIcon = () => (
  <View style={styles.historyIconContainer}>
    <View style={styles.historyClockCircle} />
    <View style={styles.historyClockHand} />
  </View>
);

const PenIcon = () => (
  <View style={styles.penIconContainer}>
    <View style={styles.penBody} />
    <View style={styles.penTip} />
  </View>
);

const SearchIcon = () => (
  <View style={styles.searchIconContainer}>
    <View style={styles.searchCircle} />
    <View style={styles.searchTail} />
  </View>
);

const VideoIcon = () => (
  <View style={styles.videoIconContainer}>
    <View style={styles.videoRect} />
    <View style={styles.videoTriangle} />
  </View>
);

const LibraryGridIcon = () => (
  <View style={styles.libraryGridIconContainer}>
    <View style={styles.gridDot} />
    <View style={styles.gridDot} />
    <View style={styles.gridDot} />
    <View style={styles.gridDot} />
  </View>
);

const PlusIcon = () => (
  <View style={styles.plusIconContainer}>
    <View style={styles.plusVertical} />
    <View style={styles.plusHorizontal} />
  </View>
);

const GearIcon = () => (
  <View style={styles.gearIconContainer}>
    <View style={styles.gearOuterCircle} />
    <View style={styles.gearInnerCircle} />
    <View style={[styles.gearSpoke, { transform: [{ rotate: '0deg' }] }]} />
    <View style={[styles.gearSpoke, { transform: [{ rotate: '45deg' }] }]} />
    <View style={[styles.gearSpoke, { transform: [{ rotate: '90deg' }] }]} />
    <View style={[styles.gearSpoke, { transform: [{ rotate: '135deg' }] }]} />
  </View>
);

const DoubleLineIcon = () => (
  <View style={styles.doubleLineIconContainer}>
    <View style={styles.menuLine} />
    <View style={styles.menuLine} />
  </View>
);

export default function App() {
  // Splash & Animation values
  const [showSplash, setShowSplash] = useState(true);
  const splashOpacity = useRef(new Animated.Value(0)).current;
  const splashScale = useRef(new Animated.Value(0.3)).current;

  // Cartoon Waving Animation values
  const waveAnim = useRef(new Animated.Value(0)).current;
  const hiBubbleScale = useRef(new Animated.Value(1)).current;

  // History Drawer State
  const [showHistory, setShowHistory] = useState(false);
  const drawerTranslateX = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  // Chat states
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Custom interactive features
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showPromptLibrary, setShowPromptLibrary] = useState(false);
  const [notebookMode, setNotebookMode] = useState(false);
  
  // Saved chats (prefilled with mock histories categorized by date/time!)
  const [savedChats, setSavedChats] = useState<SavedChat[]>([
    {
      id: 'mock-1',
      title: 'Brainstorming React Cards',
      timestamp: 'May 31, 2026, 03:45 PM',
      messages: [
        { id: '1', sender: 'user', text: 'Help me design a card.' },
        { id: '2', sender: 'gemini', text: 'Sure! Here is a clean responsive card using CSS flexbox.' }
      ]
    },
    {
      id: 'mock-2',
      title: 'Mobile Responsive Layouts',
      timestamp: 'May 30, 2026, 09:20 AM',
      messages: [
        { id: '1', sender: 'user', text: 'Explain dynamic viewport height.' },
        { id: '2', sender: 'gemini', text: 'Dynamic Viewport Height (`dvh`) automatically accounts for mobile browser address bars!' }
      ]
    }
  ]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // Thinking Animation values
  const thinkingSpin = useRef(new Animated.Value(0)).current;
  const thinkingPulse = useRef(new Animated.Value(1)).current;

  // 1. Initial Opening Splash Animation
  useEffect(() => {
    // Fade in and scale up the splash icon
    Animated.parallel([
      Animated.timing(splashOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(splashScale, {
        toValue: 1,
        duration: 1000,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      })
    ]).start();

    // After 2.5 seconds, fade out the splash and open the app
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(splashOpacity, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(splashScale, {
          toValue: 1.3,
          duration: 600,
          useNativeDriver: true,
        })
      ]).start(() => {
        setShowSplash(false);
      });
    }, 2400);

    return () => clearTimeout(timer);
  }, []);

  // 2. Drawer Slide Animation
  useEffect(() => {
    Animated.timing(drawerTranslateX, {
      toValue: showHistory ? 0 : SCREEN_WIDTH,
      duration: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [showHistory]);

  // 2B. Waving & Speech Bubble Loops
  useEffect(() => {
    // Waving hand loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(waveAnim, {
          toValue: 1,
          duration: 400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(waveAnim, {
          toValue: 0,
          duration: 400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        })
      ])
    ).start();

    // speech bubble scale pulse loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(hiBubbleScale, {
          toValue: 1.12,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(hiBubbleScale, {
          toValue: 0.92,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        })
      ])
    ).start();
  }, []);

  const handRotation = waveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-10deg', '15deg']
  });

  // 3. AI Thinking Rotation & Pulse
  useEffect(() => {
    let spinLoop: Animated.CompositeAnimation | null = null;
    let pulseLoop: Animated.CompositeAnimation | null = null;

    if (isLoading) {
      thinkingSpin.setValue(0);
      thinkingPulse.setValue(1);

      spinLoop = Animated.loop(
        Animated.timing(thinkingSpin, {
          toValue: 1,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );

      pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(thinkingPulse, {
            toValue: 1.15,
            duration: 850,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(thinkingPulse, {
            toValue: 0.95,
            duration: 850,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          })
        ])
      );

      spinLoop.start();
      pulseLoop.start();
    } else {
      if (spinLoop) spinLoop.stop();
      if (pulseLoop) pulseLoop.stop();
      thinkingSpin.setValue(0);
      thinkingPulse.setValue(1);
    }

    return () => {
      if (spinLoop) spinLoop.stop();
      if (pulseLoop) pulseLoop.stop();
    };
  }, [isLoading]);

  const spinRotation = thinkingSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  // Action: Pick Image
  const handleImageUpload = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      alert("Permission to access gallery is required!");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets[0].base64) {
      const mimeType = result.assets[0].mimeType || 'image/jpeg';
      const base64Data = `data:${mimeType};base64,${result.assets[0].base64}`;
      setSelectedImage(base64Data);
    }
  };

  // Action: Send Message
  const handleSend = async () => {
    if ((!inputValue.trim() && !selectedImage) || isLoading) return;

    const textToSend = inputValue.trim();
    const imageToSend = selectedImage;

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend,
      imageBase64: imageToSend || undefined,
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputValue('');
    setSelectedImage(null);
    setIsLoading(true);
    Keyboard.dismiss();

    try {
      const slicedMessages = newMessages.slice(-6);
      const history = slicedMessages.map(msg => ({
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

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            ...history,
            {
              role: 'user',
              parts: [
                ...(imageToSend ? [{
                  inlineData: {
                    mimeType: imageToSend.match(/^data:(image\/[a-z]+);base64,/)?.[1] || 'image/jpeg',
                    data: imageToSend.split(',')[1] || imageToSend
                  }
                }] : []),
                { text: textToSend }
              ]
            }
          ],
          generationConfig: {
            maxOutputTokens: 800,
          },
          systemInstruction: {
            parts: [{
              text: "You are Evolve AI, a premium, highly advanced AI assistant powered by Google's Gemini AI. Keep this personal profile context of your user in mind at all times: his name is Uday Bhaskar Kalle, he also goes by the name 'Buddy', and he is a Pro/Premium subscriber on the Evolve platform. Greet him as 'Buddy' or by his name when appropriate. Maintain a supportive, articulate, and professional peer-to-peer tone. Keep your responses highly concise, precise, direct, and speed-optimized. You can assist with anything, including coding, design, analysis, creative writing, and image understanding. Lead directly with impactful and well-structured answers, minimizing empty conversational filler."
            }]
          }
        })
      });

      if (!response.ok) {
        throw new Error('Gemini API call failed');
      }

      const data = await response.json();
      const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || "No reply from Gemini.";

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'gemini',
        text: answer,
      };

      const finalMessages = [...newMessages, botMessage];
      setMessages(finalMessages);

      // Auto update active chat in history
      if (activeChatId) {
        setSavedChats(prev => prev.map(chat => 
          chat.id === activeChatId ? { ...chat, messages: finalMessages } : chat
        ));
      }
    } catch (error) {
      console.error(error);
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: 'gemini',
        text: '*Error: Could not reach the Gemini AI Engine.*',
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const fillPrompt = (prompt: string) => {
    setInputValue(prompt);
  };

  // Action: New Chat (archives current chat to history if active, then clears)
  const startNewChat = () => {
    if (messages.length > 0) {
      // Archive current chat
      const date = new Date();
      const timestampString = date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      }) + ', ' + date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });

      const newHistoryItem: SavedChat = {
        id: activeChatId || Date.now().toString(),
        title: messages[0].text.substring(0, 25) + (messages[0].text.length > 25 ? '...' : ''),
        timestamp: timestampString,
        messages: messages
      };

      setSavedChats(prev => {
        const index = prev.findIndex(item => item.id === newHistoryItem.id);
        if (index > -1) {
          const updated = [...prev];
          updated[index] = newHistoryItem;
          return updated;
        }
        return [newHistoryItem, ...prev];
      });
    }

    setMessages([]);
    setSelectedImage(null);
    setInputValue('');
    setActiveChatId(null);
    setNotebookMode(false); // Reset notebook mode for normal chats
    setShowHistory(false);
  };

  // Helper Action: New Notebook Mode
  const startNewNotebook = () => {
    setMessages([]);
    setSelectedImage(null);
    setInputValue('');
    setActiveChatId(null);
    setNotebookMode(true);
    setShowHistory(false);
    
    // Add an initial greeting message in Notebook Mode!
    setMessages([
      {
        id: 'nb-welcome',
        sender: 'gemini',
        text: "📝 **Welcome to Evolve Notebook Mode!**\n\nI am configured as your long-form document and research editor.\n\n*You are running in Pro Notebook Mode. Ask me to outline a topic, compose a script, or build extensive academic notes!*"
      }
    ]);
  };

  // Helper Action: Video Hub Simulation
  const handleVideosTap = () => {
    const videoMessage: Message = {
      id: Date.now().toString(),
      sender: 'gemini',
      text: "🎥 **Welcome to the Evolve Video Hub!**\n\nHere are curated video guides to help you master AI engineering and UI design:\n\n1. 🛠️ **Build a Premium React Native Chat App**\n   *Duration: 12 mins* | [Watch Tutorial](https://www.youtube.com/watch?v=dQw4w9WgXcQ)\n\n2. 🔑 **Advanced Prompt Engineering with Gemini 2.5 Flash**\n   *Duration: 15 mins* | [Watch Tutorial](https://www.youtube.com/watch?v=dQw4w9WgXcQ)\n\n3. 🎨 **Designing Ambient Mesh UI Backgrounds**\n   *Duration: 8 mins* | [Watch Tutorial](https://www.youtube.com/watch?v=dQw4w9WgXcQ)\n\n*Tap any prompt below, or ask me for more specific educational resources!*"
    };
    setMessages([videoMessage]);
    setShowHistory(false);
  };

  // Action: Restore Chat History
  const loadChatFromHistory = (chat: SavedChat) => {
    setMessages(chat.messages);
    setActiveChatId(chat.id);
    setSelectedImage(null);
    setInputValue('');
    setShowHistory(false);
  };

  // Render Custom Opening Splash Screen
  if (showSplash) {
    return (
      <View style={styles.splashContainer}>
        <Animated.View style={[
          styles.splashContent,
          { opacity: splashOpacity, transform: [{ scale: splashScale }] }
        ]}>
          <Image 
            source={require('./assets/icon.png')} 
            style={styles.splashLogo} 
          />
          <Text style={styles.splashText}>EVOLVE</Text>
        </Animated.View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0b0b0c" />
      
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Header styled exactly like Google Gemini */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Evolve</Text>
          </View>

          {/* Dynamic Logo Animation / Menu Toggle on Right */}
          <View style={styles.headerRight}>
            {messages.length > 0 && (
              <TouchableOpacity onPress={startNewChat} style={styles.clearButton} activeOpacity={0.7}>
                <TrashIcon />
              </TouchableOpacity>
            )}
            {isLoading && (
              <Animated.View style={{ 
                transform: [{ rotate: spinRotation }, { scale: thinkingPulse }],
                marginRight: 10
              }}>
                <Image 
                  source={require('./assets/icon.png')} 
                  style={styles.headerAnimatedLogo} 
                />
              </Animated.View>
            )}
            <TouchableOpacity 
              onPress={() => setShowHistory(true)} 
              style={styles.menuToggleBtn}
              activeOpacity={0.7}
            >
              <DoubleLineIcon />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.innerContainer}>
          {notebookMode && (
            <View style={styles.notebookBanner}>
              <Text style={styles.notebookBannerText}>📝 Notebook Editor Mode Active</Text>
            </View>
          )}

          {messages.length === 0 ? (
            <View style={styles.welcomeContainer}>
              {/* Static Avatar Image */}
              <Image 
                source={require('./assets/waving-person.png')} 
                style={styles.staticAvatar} 
              />

              <Text style={styles.welcomeTitle}>Hello, Buddy.</Text>
              <Text style={styles.welcomeSubtitle}>How can Gemini AI help you today?</Text>
              
              <View style={styles.starterContainer}>
                <TouchableOpacity 
                  onPress={() => fillPrompt("Analyze this image and describe its key elements.")} 
                  style={styles.starterButton}
                  activeOpacity={0.8}
                >
                  <Text style={styles.starterButtonText}>Image Analysis &rarr;</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => fillPrompt("Write a clean, responsive card component in React.")} 
                  style={styles.starterButton}
                  activeOpacity={0.8}
                >
                  <Text style={styles.starterButtonText}>React Component &rarr;</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => fillPrompt("Help me brainstorm creative ideas for a personal project.")} 
                  style={styles.starterButton}
                  activeOpacity={0.8}
                >
                  <Text style={styles.starterButtonText}>Creative Brainstorm &rarr;</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
              onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
              renderItem={({ item }) => (
                <View style={styles.messageRow}>
                  {/* Avatar */}
                  <View style={[
                    styles.avatar, 
                    item.sender === 'user' ? styles.userAvatar : styles.geminiAvatar
                  ]}>
                    <Text style={styles.avatarText}>{item.sender === 'user' ? 'U' : 'G'}</Text>
                  </View>

                  {/* Message Bubble */}
                  <View style={styles.messageContent}>
                    {item.imageBase64 && (
                      <Image source={{ uri: item.imageBase64 }} style={styles.messageImage} />
                    )}
                    {parseText(item.text)}
                  </View>
                </View>
              )}
              ListFooterComponent={() => isLoading ? (
                <View style={styles.messageRow}>
                  <View style={[styles.avatar, styles.geminiAvatar]}>
                    <Text style={styles.avatarText}>G</Text>
                  </View>
                  <View style={styles.loadingContainer}>
                    <Animated.View style={{ transform: [{ rotate: spinRotation }] }}>
                      <Image 
                        source={require('./assets/icon.png')} 
                        style={styles.typingLogo} 
                      />
                    </Animated.View>
                  </View>
                </View>
              ) : null}
            />
          )}

          {/* Bottom Dock Input Bar */}
          <View style={styles.inputDock}>
            {selectedImage && (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: selectedImage }} style={styles.imagePreview} />
                <TouchableOpacity onPress={() => setSelectedImage(null)} style={styles.imagePreviewClose}>
                  <CloseIcon />
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.inputContainer}>
              <TouchableOpacity onPress={handleImageUpload} style={styles.attachButton} activeOpacity={0.7}>
                <ImageIcon />
              </TouchableOpacity>

              <TextInput
                value={inputValue}
                onChangeText={setInputValue}
                placeholder="Ask Gemini anything, or attach image..."
                placeholderTextColor="#808184"
                style={styles.input}
                multiline
                maxLength={500}
              />

              <TouchableOpacity 
                onPress={handleSend} 
                disabled={isLoading || (!inputValue.trim() && !selectedImage)}
                style={[
                  styles.sendButton,
                  (isLoading || (!inputValue.trim() && !selectedImage)) && styles.sendButtonDisabled
                ]}
                activeOpacity={0.7}
              >
                <SendIcon />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Slide-out Chat History Drawer (Official Gemini Mobile style!) */}
      {showHistory && (
        <TouchableOpacity 
          style={styles.drawerOverlay} 
          activeOpacity={1} 
          onPress={() => setShowHistory(false)}
        >
          <Animated.View 
            style={[
              styles.historyDrawer,
              { transform: [{ translateX: drawerTranslateX }] }
            ]}
          >
            {/* 1. Drawer Header */}
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerHeaderTitle}>Evolve</Text>
              <TouchableOpacity onPress={() => setShowHistory(false)} style={styles.drawerCloseButton}>
                <DoubleLineIcon />
              </TouchableOpacity>
            </View>

            {/* 1B. Drawer Search Bar */}
            {isSearching && (
              <View style={styles.searchBarContainer}>
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search chat titles..."
                  placeholderTextColor="#808184"
                  style={styles.searchBarInput}
                  autoFocus
                />
                <TouchableOpacity onPress={() => { setSearchQuery(''); setIsSearching(false); }} style={styles.searchBarClear}>
                  <CloseIcon />
                </TouchableOpacity>
              </View>
            )}

            {/* 2. New Chat Pill Button */}
            <TouchableOpacity 
              onPress={startNewChat} 
              style={styles.newChatPillButton} 
              activeOpacity={0.8}
            >
              <PenIcon />
              <Text style={styles.newChatPillText}>New chat</Text>
            </TouchableOpacity>

            {/* 3. Navigation List Items */}
            <View style={styles.navItemsList}>
              <TouchableOpacity onPress={() => setIsSearching(!isSearching)} style={styles.navItem} activeOpacity={0.7}>
                <SearchIcon />
                <Text style={styles.navItemText}>Search chats</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleVideosTap} style={styles.navItem} activeOpacity={0.7}>
                <VideoIcon />
                <Text style={styles.navItemText}>Videos</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowPromptLibrary(true)} style={styles.navItem} activeOpacity={0.7}>
                <LibraryGridIcon />
                <Text style={styles.navItemText}>Library</Text>
              </TouchableOpacity>
            </View>

            {/* 4. Notebooks Section */}
            <View style={styles.sectionHeaderContainer}>
              <Text style={styles.sectionHeaderTitle}>Notebooks</Text>
            </View>
            <TouchableOpacity onPress={startNewNotebook} style={styles.navItem} activeOpacity={0.7}>
              <PlusIcon />
              <Text style={styles.navItemText}>New notebook</Text>
            </TouchableOpacity>

            {/* 5. Recent History Section */}
            <View style={styles.sectionHeaderContainer}>
              <Text style={styles.sectionHeaderTitle}>Recent</Text>
            </View>

            <View style={styles.historyListContainer}>
              {savedChats.length === 0 ? (
                <View style={styles.skeletonContainer}>
                  <View style={[styles.skeletonBar, { width: '85%' }]} />
                  <View style={[styles.skeletonBar, { width: '55%' }]} />
                  <View style={[styles.skeletonBar, { width: '70%' }]} />
                </View>
              ) : (
                <FlatList
                  data={savedChats.filter(chat => chat.title.toLowerCase().includes(searchQuery.toLowerCase()))}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.drawerList}
                  renderItem={({ item }) => (
                    <TouchableOpacity 
                      onPress={() => loadChatFromHistory(item)}
                      style={[
                        styles.historyItem,
                        activeChatId === item.id && styles.historyItemActive
                      ]}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.historyItemTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>


          </Animated.View>
        </TouchableOpacity>
      )}

      {/* 7. Prompt Library Modal Overlay */}
      {showPromptLibrary && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Prompt Library</Text>
              <TouchableOpacity onPress={() => setShowPromptLibrary(false)} style={styles.modalCloseButton}>
                <CloseIcon />
              </TouchableOpacity>
            </View>

            <FlatList
              data={[
                { category: 'Coding & Dev', prompt: 'Write a clean, responsive card component in React.' },
                { category: 'Coding & Dev', prompt: 'Create a beautiful CSS mesh gradient animation.' },
                { category: 'Creative & Writing', prompt: 'Help me brainstorm creative ideas for a personal project.' },
                { category: 'Creative & Writing', prompt: 'Write an engaging storytelling intro about space exploration.' },
                { category: 'Analysis & Reviews', prompt: 'Analyze this image and describe its key elements.' },
                { category: 'Analysis & Reviews', prompt: 'Review my code for performance optimization bottlenecks.' },
              ]}
              keyExtractor={(item, index) => index.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  onPress={() => {
                    setInputValue(item.prompt);
                    setShowPromptLibrary(false);
                    setShowHistory(false);
                  }}
                  style={styles.libraryPromptCard}
                >
                  <Text style={styles.libraryCategoryText}>{item.category}</Text>
                  <Text style={styles.libraryPromptText}>{item.prompt}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0b0c',
  },
  // Custom Splash screen
  splashContainer: {
    flex: 1,
    backgroundColor: '#0b0b0c',
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashContent: {
    alignItems: 'center',
  },
  splashLogo: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
    marginBottom: 20,
  },
  splashText: {
    color: '#fff',
    fontSize: 26,
    fontWeight: 'bold',
    letterSpacing: 4,
    textShadowColor: 'rgba(155, 81, 224, 0.4)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 15,
  },
  keyboardView: {
    flex: 1,
  },
  innerContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    backgroundColor: '#0b0b0c',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuToggleBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: -0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  headerAnimatedLogo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#9333ea',
  },
  clearButton: {
    padding: 8,
    marginLeft: 10,
  },
  welcomeContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 25,
    paddingBottom: 50,
  },
  welcomeTitle: {
    fontSize: 42,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 20,
    color: '#808184',
    marginBottom: 40,
  },
  starterContainer: {
    gap: 12,
  },
  starterButton: {
    backgroundColor: 'rgba(40, 42, 44, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 18,
  },
  starterButtonText: {
    fontSize: 16,
    color: '#e3e3e3',
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 15,
    paddingTop: 15,
    paddingBottom: 20,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  userAvatar: {
    backgroundColor: '#595b5a',
  },
  geminiAvatar: {
    backgroundColor: '#9333ea',
  },
  avatarText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  messageContent: {
    flex: 1,
    alignItems: 'flex-start',
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 8,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#e3e3e3',
  },
  normalText: {
    color: '#e3e3e3',
  },
  boldText: {
    fontWeight: 'bold',
    color: '#fff',
  },
  italicText: {
    fontStyle: 'italic',
    color: '#e3e3e3',
  },
  codeContainer: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginHorizontal: 2,
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#f43f5e',
    fontSize: 14,
  },
  loadingContainer: {
    paddingTop: 4,
  },
  typingLogo: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  inputDock: {
    paddingHorizontal: 15,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 20 : 15,
    backgroundColor: '#0b0b0c',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.03)',
  },
  imagePreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(40, 42, 44, 0.4)',
    borderRadius: 12,
    padding: 8,
    marginBottom: 10,
    width: 100,
    height: 70,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  imagePreviewClose: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1f20',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 28,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  attachButton: {
    padding: 8,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    maxHeight: 100,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
  },
  sendButton: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.3,
  },
  drawerOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 999,
  },
  historyDrawer: {
    width: SCREEN_WIDTH * 0.85,
    height: '100%',
    backgroundColor: '#000',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingHorizontal: 20,
    position: 'absolute',
    right: 0,
    bottom: 0,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  drawerHeaderTitle: {
    fontSize: 24,
    fontWeight: '500',
    color: '#fff',
    letterSpacing: -0.5,
  },
  drawerCloseButton: {
    padding: 8,
  },
  newChatPillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131314',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 25,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  newChatPillText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 15,
  },
  navItemsList: {
    marginBottom: 20,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginBottom: 4,
    borderRadius: 10,
  },
  navItemText: {
    color: '#e3e3e3',
    fontSize: 15,
    fontWeight: '500',
    marginLeft: 18,
  },
  sectionHeaderContainer: {
    paddingHorizontal: 10,
    marginTop: 20,
    marginBottom: 10,
  },
  sectionHeaderTitle: {
    color: '#808184',
    fontSize: 13,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  historyListContainer: {
    flex: 1,
  },
  drawerList: {
    paddingBottom: 20,
  },
  emptyHistoryContainer: {
    paddingVertical: 20,
    paddingHorizontal: 10,
  },
  emptyHistoryText: {
    color: '#808184',
    fontSize: 14,
  },
  skeletonContainer: {
    paddingHorizontal: 10,
    paddingTop: 10,
    gap: 16,
  },
  skeletonBar: {
    height: 14,
    backgroundColor: '#1e1f20',
    borderRadius: 7,
  },
  historyItem: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 2,
  },
  historyItemActive: {
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  historyItemTitle: {
    color: '#e3e3e3',
    fontSize: 15,
    fontWeight: '400',
  },
  drawerFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
    marginTop: 10,
    marginBottom: Platform.OS === 'ios' ? 10 : 0,
  },
  footerLeft: {
    flex: 1,
  },
  footerUsername: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 0.2,
  },
  footerProBadge: {
    color: '#808184',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  settingsButton: {
    padding: 8,
  },
  penIconContainer: {
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  penBody: {
    width: 6,
    height: 14,
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 1,
    transform: [{ rotate: '45deg' }],
  },
  penTip: {
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderBottomWidth: 4,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#fff',
    position: 'absolute',
    bottom: 0,
    left: 2,
    transform: [{ rotate: '45deg' }],
  },
  searchIconContainer: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#e3e3e3',
  },
  searchTail: {
    width: 2,
    height: 6,
    backgroundColor: '#e3e3e3',
    position: 'absolute',
    bottom: 1,
    right: 1,
    transform: [{ rotate: '-45deg' }],
  },
  videoIconContainer: {
    width: 20,
    height: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  videoRect: {
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: 2,
    borderColor: '#e3e3e3',
  },
  videoTriangle: {
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderTopWidth: 4,
    borderBottomWidth: 4,
    borderLeftWidth: 5,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#e3e3e3',
    marginLeft: 1,
  },
  libraryGridIconContainer: {
    width: 20,
    height: 20,
    flexWrap: 'wrap',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignContent: 'space-between',
    padding: 2,
  },
  gridDot: {
    width: 7,
    height: 7,
    borderRadius: 2,
    borderWidth: 1.5,
    borderColor: '#e3e3e3',
  },
  plusIconContainer: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusVertical: {
    width: 2,
    height: 14,
    backgroundColor: '#e3e3e3',
    borderRadius: 1,
  },
  plusHorizontal: {
    width: 14,
    height: 2,
    backgroundColor: '#e3e3e3',
    borderRadius: 1,
    position: 'absolute',
  },
  gearIconContainer: {
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gearOuterCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#fff',
  },
  gearInnerCircle: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
    position: 'absolute',
  },
  gearSpoke: {
    width: 20,
    height: 2,
    backgroundColor: '#fff',
    position: 'absolute',
  },
  doubleLineIconContainer: {
    width: 22,
    height: 10,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  menuLine: {
    width: 20,
    height: 2,
    backgroundColor: '#fff',
    borderRadius: 1,
  },
  sendIconContainer: {
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
  },
  sendIconArrow: {
    width: 10,
    height: 10,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: '#4285f4',
    transform: [{ rotate: '-45deg' }],
  },
  trashContainer: {
    width: 16,
    height: 20,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trashLid: {
    width: 14,
    height: 3,
    backgroundColor: '#808184',
    borderRadius: 1,
  },
  trashBody: {
    width: 12,
    height: 15,
    borderWidth: 2,
    borderColor: '#808184',
    borderRadius: 2,
  },
  imageIconContainer: {
    width: 22,
    height: 18,
    borderWidth: 2,
    borderColor: '#4285f4',
    borderRadius: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageIconOuter: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#4285f4',
    position: 'absolute',
    top: 2,
    right: 2,
  },
  imageIconInner: {
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#4285f4',
    position: 'absolute',
    bottom: 0,
  },
  closeIconContainer: {
    width: 12,
    height: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIconLine: {
    position: 'absolute',
    width: 10,
    height: 2,
    backgroundColor: '#fff',
    borderRadius: 1,
  },
  historyIconContainer: {
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyClockCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#808184',
  },
  historyClockHand: {
    width: 2,
    height: 6,
    backgroundColor: '#808184',
    position: 'absolute',
    top: 5,
    left: 10,
    transform: [{ rotate: '45deg' }],
  },
  staticAvatar: {
    width: 130,
    height: 130,
    alignSelf: 'center',
    marginBottom: 20,
    transform: [{ translateX: -110 }], // Move extremely far to the left
  },
  notebookBanner: {
    backgroundColor: 'rgba(66, 133, 244, 0.15)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(66, 133, 244, 0.25)',
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notebookBannerText: {
    color: '#4285f4',
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131314',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 10,
    marginBottom: 15,
    height: 44,
  },
  searchBarInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    paddingVertical: 4,
  },
  searchBarClear: {
    padding: 4,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContainer: {
    width: '90%',
    height: '70%',
    backgroundColor: '#131314',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalCloseButton: {
    padding: 8,
  },
  libraryPromptCard: {
    backgroundColor: '#1e1f20',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  libraryCategoryText: {
    fontSize: 11,
    color: '#4285f4',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  libraryPromptText: {
    fontSize: 14,
    color: '#e3e3e3',
    lineHeight: 20,
  },
});
