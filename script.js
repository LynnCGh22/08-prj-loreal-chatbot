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
  chatForm.querySelector("button").textContent = userInput.value.trim() === "" ? "Type a message..." : "Send";
});

const workerUrl = "https://sweet-wind-0854.lchaker921.workers.dev/"; // Replace with your Cloudflare Worker URL


// Set initial message
chatWindow.textContent = "👋 Hello! How can I help you today?";

/* Handle form submit */
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();

  // When using Cloudflare, you'll need to POST a `messages` array in the body,
  // and handle the response using: data.choices[0].message.content

  // Show message
  chatWindow.innerHTML = "Connect to the OpenAI API for a response!";
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
