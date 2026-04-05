/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");

const themeToggle = document.getElementById("themeToggle");
const logo = document.getElementById("logo");
const body = document.body;

// Activate the chat button only when there is input
userInput.addEventListener("input", () => {
  chatForm.querySelector("button").disabled = userInput.value.trim() === "";
  chatForm.querySelector("button").textContent =
    userInput.value.trim() === "" ? "Type a message..." : "Send";
});

const workerUrl = "https://sweet-wind-0854.lchaker921.workers.dev/"; // Replace with your Cloudflare Worker URL

// Set initial message
chatWindow.textContent = "Hi there! How can I help you today?";

/* Handle form submit */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const userQuestion = userInput.value.trim();
  if (!userQuestion) {
    return;
  }

  chatWindow.textContent = "Thinking...";

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
              "You are a professional workplace assistant. Use a formal, serious tone. Structure responses clearly with concise sections using headings when helpful, and provide direct, practical recommendations. Avoid slang, jokes, emojis, and overly casual or comical phrasing, and do not diverge too far from the topic.",
          },
          { role: "user", content: userQuestion },
        ],
        max_completion_tokens: 500, // Limit response length for better performance and more direct responses
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
    // Set responseDiv.textContent to show this to the user
    const data = await res.json();
    chatWindow.textContent =
      data.choices?.[0]?.message?.content ||
      data.reply ||
      data.response ||
      "No response received.";
  } catch (error) {
    //  Handle errors gracefully by doing TWO things:
    //   1. Log the error to the console so you can debug (use console.error)
    //   2. Show a user-friendly error message in responseDiv

    console.error(error);
    // Show clearer guidance for the most common Cloudflare Worker setup issues.
    if (error instanceof TypeError) {
      chatWindow.textContent =
        "Connection blocked. This is usually a CORS issue in your Cloudflare Worker.";
    } else if (error instanceof Error && error.message.includes("non-JSON")) {
      chatWindow.textContent =
        "Connected to Worker, but it is not returning AI JSON yet. Check Worker code.";
    } else {
      chatWindow.textContent = "Sorry, something went wrong. Please try again.";
    }
    alert("An error occurred while fetching the AI response. Please check your network connection and the console for more details.",);
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
