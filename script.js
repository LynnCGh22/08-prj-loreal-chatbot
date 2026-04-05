/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const sendBtn = chatForm.querySelector("button");

const themeToggle = document.getElementById("themeToggle");
const logo = document.getElementById("logo");
const body = document.body;

const CHAT_HISTORY_KEY = "lorealChatHistory";
const MAX_STORED_MESSAGES = 30;

let conversationHistory = [];

function loadConversationHistory() {
  const rawHistory = localStorage.getItem(CHAT_HISTORY_KEY);
  if (!rawHistory) {
    return [];
  }

  try {
    const parsedHistory = JSON.parse(rawHistory);
    if (!Array.isArray(parsedHistory)) {
      return [];
    }

    // Keep only valid role/content entries so bad data does not break chat rendering.
    return parsedHistory.filter(
      (item) =>
        item &&
        (item.role === "user" || item.role === "ai") &&
        typeof item.content === "string" &&
        item.content.trim() !== "",
    );
  } catch {
    return [];
  }
}

function saveConversationHistory() {
  const trimmedHistory = conversationHistory.slice(-MAX_STORED_MESSAGES);
  conversationHistory = trimmedHistory;
  localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(trimmedHistory));
}

function addMessageToHistory(role, text) {
  const message = document.createElement("div");
  message.className = `msg ${role}`;
  message.textContent = text;
  chatWindow.appendChild(message);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function addMessageAndPersist(role, text) {
  addMessageToHistory(role, text);
  conversationHistory.push({ role, content: text });
  saveConversationHistory();
}

function updateSendButton() {
  const hasText = userInput.value.trim() !== "";
  sendBtn.disabled = !hasText;
}

// Activate the chat button only when there is input
userInput.addEventListener("input", () => {
  updateSendButton();
});

const workerUrl = "https://sweet-wind-0854.lchaker921.workers.dev/"; // Replace with your Cloudflare Worker URL

// Restore previous conversation from local storage.
conversationHistory = loadConversationHistory();
if (conversationHistory.length === 0) {
  addMessageAndPersist("ai", "Hi there! How can I help you today?");
} else {
  conversationHistory.forEach((message) => {
    addMessageToHistory(message.role, message.content);
  });
}

updateSendButton();

/* Handle form submit */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const userQuestion = userInput.value.trim();
  if (!userQuestion) {
    return;
  }

  addMessageAndPersist("user", userQuestion);
  userInput.value = "";
  updateSendButton();
  addMessageToHistory("ai", "Thinking...");

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
          ...conversationHistory.map((message) => ({
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

    // Extract and display the AI's response
    // OpenAI returns the message in: data.choices[0].message.content
    const data = await res.json();
    const aiResponse =
      data.choices?.[0]?.message?.content ||
      data.reply ||
      data.response ||
      "No response received.";

    // Replace the temporary "Thinking..." message with the final AI response.
    if (chatWindow.lastElementChild) {
      chatWindow.removeChild(chatWindow.lastElementChild);
    }
    addMessageAndPersist("ai", aiResponse);
  } catch (error) {
    console.error(error);
    // Show clearer guidance for the most common Cloudflare Worker setup issues.
    if (error instanceof TypeError) {
      chatWindow.lastElementChild.textContent =
        "Connection blocked. This is usually a CORS issue in your Cloudflare Worker.";
    } else if (error instanceof Error && error.message.includes("non-JSON")) {
      chatWindow.lastElementChild.textContent =
        "Connected to Worker, but it is not returning AI JSON yet. Check Worker code.";
    } else {
      chatWindow.lastElementChild.textContent =
        "Sorry, something went wrong. Please try again.";
    }
    alert(
      "An error occurred while fetching the AI response. Please check your network connection and the console for more details.",
    );
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
