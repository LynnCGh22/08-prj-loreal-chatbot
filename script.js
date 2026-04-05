/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const sendBtn = document.getElementById("sendBtn");
const historyList = document.getElementById("historyList");
const newChatBtn = document.getElementById("newChatBtn");

const themeToggle = document.getElementById("themeToggle");
const logo = document.getElementById("logo");
const body = document.body;

const CHAT_SESSIONS_KEY = "lorealChatSessions";
const ACTIVE_CHAT_KEY = "lorealActiveChatId";
const LEGACY_CHAT_HISTORY_KEY = "lorealChatHistory";
const MAX_STORED_CHATS = 20;
const MAX_MESSAGES_PER_CHAT = 30;

const workerUrl = "https://sweet-wind-0854.lchaker921.workers.dev/"; // Replace with your Cloudflare Worker URL

let chatSessions = [];
let activeChatId = null;
let isRequestPending = false;

function createId() {
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function truncateTitle(text) {
  const trimmed = text.trim();
  if (!trimmed) {
    return "New chat";
  }

  return trimmed.length > 36 ? `${trimmed.slice(0, 36)}...` : trimmed;
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isValidMessage(message) {
  return (
    message &&
    (message.role === "user" || message.role === "ai") &&
    typeof message.content === "string" &&
    message.content.trim() !== ""
  );
}

function isValidChatSession(session) {
  return (
    session &&
    typeof session.id === "string" &&
    typeof session.title === "string" &&
    Array.isArray(session.messages)
  );
}

function saveChatSessions() {
  const sortedSessions = [...chatSessions]
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, MAX_STORED_CHATS)
    .map((session) => ({
      ...session,
      messages: session.messages.slice(-MAX_MESSAGES_PER_CHAT),
    }));

  chatSessions = sortedSessions;
  localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(sortedSessions));
  localStorage.setItem(ACTIVE_CHAT_KEY, activeChatId || "");
}

function loadLegacyChatHistory() {
  const rawLegacy = localStorage.getItem(LEGACY_CHAT_HISTORY_KEY);
  if (!rawLegacy) {
    return null;
  }

  try {
    const parsedLegacy = JSON.parse(rawLegacy);
    if (!Array.isArray(parsedLegacy)) {
      return null;
    }

    const validMessages = parsedLegacy.filter(isValidMessage);
    if (validMessages.length === 0) {
      return null;
    }

    return {
      id: createId(),
      title: "Previous chat",
      messages: validMessages,
      updatedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

function createNewChatSession() {
  return {
    id: createId(),
    title: "New chat",
    messages: [{ role: "ai", content: "Hi there! How can I help you today?" }],
    updatedAt: Date.now(),
  };
}

function loadChatSessions() {
  const rawSessions = localStorage.getItem(CHAT_SESSIONS_KEY);
  const savedActiveId = localStorage.getItem(ACTIVE_CHAT_KEY);

  if (rawSessions) {
    try {
      const parsedSessions = JSON.parse(rawSessions);
      if (Array.isArray(parsedSessions)) {
        chatSessions = parsedSessions
          .filter(isValidChatSession)
          .map((session) => ({
            ...session,
            messages: session.messages
              .filter(isValidMessage)
              .slice(-MAX_MESSAGES_PER_CHAT),
            updatedAt:
              typeof session.updatedAt === "number"
                ? session.updatedAt
                : Date.now(),
          }))
          .filter((session) => session.messages.length > 0);
      }
    } catch {
      chatSessions = [];
    }
  }

  if (chatSessions.length === 0) {
    const legacySession = loadLegacyChatHistory();
    if (legacySession) {
      chatSessions = [legacySession];
      localStorage.removeItem(LEGACY_CHAT_HISTORY_KEY);
    } else {
      chatSessions = [createNewChatSession()];
    }
  }

  const activeSessionExists = chatSessions.some(
    (session) => session.id === savedActiveId,
  );
  activeChatId = activeSessionExists ? savedActiveId : chatSessions[0].id;
  saveChatSessions();
}

function getActiveChatSession() {
  return chatSessions.find((session) => session.id === activeChatId);
}

function addMessageToWindow(role, text, isPending = false) {
  const message = document.createElement("div");
  message.className = `msg ${role}`;
  if (isPending) {
    message.dataset.pending = "true";
  }

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.textContent = role === "user" ? "You" : "AI";

  const body = document.createElement("div");
  body.className = "msg-body";

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  if (isPending) {
    bubble.classList.add("typing-indicator");
    bubble.innerHTML = "<span></span><span></span><span></span>";
  } else {
    bubble.textContent = text;
  }

  const meta = document.createElement("div");
  meta.className = "msg-meta";
  meta.textContent = role === "user" ? "You" : "L'Oréal Assistant";

  body.appendChild(bubble);
  body.appendChild(meta);

  message.appendChild(avatar);
  message.appendChild(body);

  chatWindow.appendChild(message);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function getPendingMessage() {
  const pendingMessages = chatWindow.querySelectorAll(
    '.msg[data-pending="true"]',
  );
  return pendingMessages[pendingMessages.length - 1] || null;
}

function updatePendingMessage(text) {
  const pendingMessage = getPendingMessage();
  if (!pendingMessage) {
    return;
  }

  const bubble = pendingMessage.querySelector(".msg-bubble");
  if (bubble) {
    bubble.classList.remove("typing-indicator");
    bubble.textContent = text;
  }

  delete pendingMessage.dataset.pending;
}

function removePendingMessage() {
  const pendingMessage = getPendingMessage();
  if (!pendingMessage) {
    return;
  }

  pendingMessage.remove();
}

function renderChatWindow() {
  chatWindow.innerHTML = "";
  const activeSession = getActiveChatSession();
  if (!activeSession) {
    return;
  }

  activeSession.messages.forEach((message) => {
    addMessageToWindow(message.role, message.content);
  });
}

function renderHistoryList() {
  historyList.innerHTML = "";
  const sessionsByRecent = [...chatSessions].sort(
    (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0),
  );

  sessionsByRecent.forEach((session) => {
    const listItem = document.createElement("li");
    listItem.className = "history-item";

    const button = document.createElement("button");
    const deleteButton = document.createElement("button");

    button.type = "button";
    button.dataset.chatId = session.id;
    button.className = session.id === activeChatId ? "active" : "";

    const title = document.createElement("span");
    title.textContent = session.title || "New chat";

    const time = document.createElement("span");
    time.className = "history-time";
    time.textContent = formatTime(session.updatedAt || Date.now());

    deleteButton.type = "button";
    deleteButton.className = "delete-chat-btn";
    deleteButton.dataset.deleteChatId = session.id;
    deleteButton.setAttribute(
      "aria-label",
      `Delete ${session.title || "chat"}`,
    );
    deleteButton.innerHTML = '<span class="material-icons">delete</span>';

    button.appendChild(title);
    button.appendChild(time);

    listItem.appendChild(button);
    listItem.appendChild(deleteButton);
    historyList.appendChild(listItem);
  });
}

function deleteChatSession(chatId) {
  const deleteIndex = chatSessions.findIndex(
    (session) => session.id === chatId,
  );
  if (deleteIndex === -1) {
    return;
  }

  chatSessions.splice(deleteIndex, 1);

  if (chatSessions.length === 0) {
    const fallbackSession = createNewChatSession();
    chatSessions = [fallbackSession];
    activeChatId = fallbackSession.id;
  } else if (activeChatId === chatId) {
    const sessionsByRecent = [...chatSessions].sort(
      (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0),
    );
    activeChatId = sessionsByRecent[0].id;
  }

  saveChatSessions();
  renderHistoryList();
  renderChatWindow();
}

function setActiveChat(chatId) {
  const exists = chatSessions.some((session) => session.id === chatId);
  if (!exists) {
    return;
  }

  activeChatId = chatId;
  saveChatSessions();
  renderHistoryList();
  renderChatWindow();
}

function addMessageAndPersist(chatId, role, text) {
  const targetSession = chatSessions.find((session) => session.id === chatId);
  if (!targetSession) {
    return;
  }

  targetSession.messages.push({ role, content: text });
  targetSession.messages = targetSession.messages.slice(-MAX_MESSAGES_PER_CHAT);
  targetSession.updatedAt = Date.now();

  if (role === "user" && targetSession.title === "New chat") {
    targetSession.title = truncateTitle(text);
  }

  saveChatSessions();

  if (activeChatId === chatId) {
    renderChatWindow();
  }

  renderHistoryList();
}

function startNewChat() {
  const newSession = createNewChatSession();
  chatSessions.unshift(newSession);
  activeChatId = newSession.id;
  saveChatSessions();
  renderHistoryList();
  renderChatWindow();
}

function updateSendButton() {
  const hasText = userInput.value.trim() !== "";
  sendBtn.disabled = !hasText || isRequestPending;
}

function initializeChatUI() {
  loadChatSessions();
  renderHistoryList();
  renderChatWindow();
  updateSendButton();
}

// Activate the chat button only when there is input
userInput.addEventListener("input", () => {
  updateSendButton();
});

newChatBtn.addEventListener("click", () => {
  if (isRequestPending) {
    return;
  }
  startNewChat();
});

historyList.addEventListener("click", (event) => {
  if (isRequestPending) {
    return;
  }

  const deleteTarget = event.target.closest("button[data-delete-chat-id]");
  if (deleteTarget) {
    const chatIdToDelete = deleteTarget.dataset.deleteChatId;
    deleteChatSession(chatIdToDelete);
    return;
  }

  const target = event.target.closest("button[data-chat-id]");
  if (!target) {
    return;
  }

  setActiveChat(target.dataset.chatId);
});

initializeChatUI();

/* Handle form submit */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (isRequestPending) {
    return;
  }

  const userQuestion = userInput.value.trim();
  if (!userQuestion) {
    return;
  }

  const requestChatId = activeChatId;
  addMessageAndPersist(requestChatId, "user", userQuestion);

  userInput.value = "";
  isRequestPending = true;
  updateSendButton();
  addMessageToWindow("ai", "Thinking...", true);

  const activeSession = chatSessions.find(
    (session) => session.id === requestChatId,
  );
  if (!activeSession) {
    isRequestPending = false;
    updateSendButton();
    return;
  }

  // When using Cloudflare, you'll need to POST a `messages` array in the body,
  // and handle the response using: data.choices[0].message.content
  try {
    const res = await fetch(workerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "You are a professional workplace assistant. Use a formal, serious tone. Structure responses clearly with concise sections using headings when helpful, and provide direct, practical recommendations. Avoid slang, jokes, emojis, and overly casual or comical phrasing, and do not diverge too far from the topic. Also, politely decline to answer any questions not related to L’Oréal products, routines, recommendations, beauty-related topics, or general beauty advice.",
          },
          ...activeSession.messages.map((message) => ({
            role: message.role === "ai" ? "assistant" : "user",
            content: message.content,
          })),
        ],
        max_completion_tokens: 1000, // Give the model more room so longer answers do not cut off too early
        temperature: 0.2, // Lower temperature for more focused, deterministic responses
        frequency_penalty: 0.2, // Slightly discourage repetition for more varied responses
        presence_penalty: 0.2, // Slightly encourage diversity for more varied responses
      }),
    });

    if (!res.ok) {
      throw new Error(`API request failed with status ${res.status}`);
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      // This helps quickly diagnose a Worker that is still using starter code and returning HTML instead of JSON
      const rawText = await res.text();
      throw new Error(`Worker returned non-JSON response: ${rawText}`);
    }

    // Extract and display the AI's response.
    // OpenAI returns the message in: data.choices[0].message.content
    const data = await res.json();
    const aiResponse =
      data.choices?.[0]?.message?.content ||
      data.reply ||
      data.response ||
      "No response received.";

    addMessageAndPersist(requestChatId, "ai", aiResponse);
  } catch (error) {
    console.error(error);

    let errorMessage = "Sorry, something went wrong. Please try again.";
    if (error instanceof TypeError) {
      errorMessage =
        "Connection blocked. This is usually a CORS issue in your Cloudflare Worker.";
    } else if (error instanceof Error && error.message.includes("non-JSON")) {
      errorMessage =
        "Connected to Worker, but it is not returning AI JSON yet. Check Worker code.";
    }

    if (activeChatId === requestChatId) {
      updatePendingMessage(errorMessage);
    }

    alert(
      "An error occurred while fetching the AI response. Please check your network connection and the console for more details.",
    );
  } finally {
    if (activeChatId === requestChatId) {
      removePendingMessage();
    }

    isRequestPending = false;
    updateSendButton();
  }
});

// Load saved theme preference on page load
const savedTheme = localStorage.getItem("theme") || "light";
if (savedTheme === "dark") {
  body.classList.add("dark-mode");
  logo.src = "img/loreal-logo-black-and-white.png"; // Use white logo for dark mode
  themeToggle.textContent = "☀️"; // Show sun icon to let user switch to light mode
} else {
  themeToggle.textContent = "🌙"; // Show moon icon to let user switch to dark mode
}

// Handle theme toggle button click
themeToggle.addEventListener("click", () => {
  body.classList.toggle("dark-mode"); // Toggle the dark-mode class

  // Update the button icon and logo based on the new mode
  if (body.classList.contains("dark-mode")) {
    logo.src = "img/loreal-logo-black-and-white.png"; // Use white logo for dark mode
    themeToggle.textContent = "☀️"; // Show sun icon to let user switch to light mode
    localStorage.setItem("theme", "dark"); // Save preference
  } else {
    logo.src = "img/loreal-logo.png"; // Use black logo for light mode
    themeToggle.textContent = "🌙"; // Show moon icon to let user switch to dark mode
    localStorage.setItem("theme", "light"); // Save preference
  }
});
