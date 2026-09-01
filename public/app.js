// ============================
// AUTHENTICATION LOGIC
// ============================

const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const switchBtn = document.getElementById("switchBtn");
const authMessage = document.getElementById("authMessage");

if (loginForm && signupForm && switchBtn) {
    let signupMode = false;

    // If user is already logged in and lands on auth.html, redirect to home
    if (localStorage.getItem("token")) {
        window.location.href = "/";
    }

    switchBtn.addEventListener("click", () => {
        signupMode = !signupMode;
        if (authMessage) authMessage.textContent = "";

        loginForm.classList.toggle("hidden");
        signupForm.classList.toggle("hidden");

        document.getElementById("authTitle").textContent =
            signupMode ? "Create your account" : "Welcome back";

        document.getElementById("switchText").textContent =
            signupMode ? "Already have an account?" : "Don't have an account?";

        switchBtn.textContent = signupMode ? "Login" : "Sign up";
    });

    // Login Handler
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (authMessage) authMessage.textContent = "Logging in...";

        const email = document.getElementById("loginEmail").value.trim();
        const password = document.getElementById("loginPassword").value;

        try {
            const response = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                const token = data.token || data.accessToken;
                localStorage.setItem("token", token);
                if (data.user) {
                    localStorage.setItem("user", JSON.stringify(data.user));
                }
                window.location.href = "/";
            } else {
                authMessage.textContent = data.error || data.message || "Login failed";
            }
        } catch (err) {
            console.error("Login fetch error:", err);
            authMessage.textContent = "Unable to connect to server. Please try again.";
        }
    });

    // Signup Handler
    signupForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (authMessage) authMessage.textContent = "Creating account...";

        const name = document.getElementById("signupName").value.trim();
        const email = document.getElementById("signupEmail").value.trim();
        const password = document.getElementById("signupPassword").value;

        try {
            const response = await fetch("/api/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, password })
            });

            const data = await response.json();

            if (response.ok) {
                authMessage.style.color = "green";
                authMessage.textContent = "Account created successfully! Please log in.";
                setTimeout(() => {
                    authMessage.style.color = "";
                    switchBtn.click();
                    const loginEmail = document.getElementById("loginEmail");
                    if (loginEmail) loginEmail.value = email;
                }, 1000);
            } else {
                authMessage.textContent = data.error || data.message || "Signup failed";
            }
        } catch (err) {
            console.error("Signup fetch error:", err);
            authMessage.textContent = "Unable to connect to server. Please try again.";
        }
    });
}


// ============================
// MAIN EVALUATION PAGE
// ============================

const recordBtn = document.getElementById("recordBtn");

if (recordBtn) {
    const token = localStorage.getItem("token");

    // Auth guard: redirect to login if no token found
    if (!token) {
        window.location.href = "/auth.html";
    }

    // Display User Profile in Navbar
    const userNameEl = document.getElementById("userName");
    const storedUser = localStorage.getItem("user");
    if (userNameEl) {
        if (storedUser) {
            try {
                const parsed = JSON.parse(storedUser);
                userNameEl.textContent = parsed.name || parsed.username || parsed.email || "User";
            } catch {
                userNameEl.textContent = "User";
            }
        } else {
            // Fetch profile using token
            fetch("/api/me", {
                headers: { "Authorization": `Bearer ${token}` }
            })
                .then(res => res.json())
                .then(user => {
                    if (user && (user.name || user.username)) {
                        userNameEl.textContent = user.name || user.username;
                        localStorage.setItem("user", JSON.stringify(user));
                    }
                })
                .catch(() => {
                    userNameEl.textContent = "User";
                });
        }
    }

    const transcriptBox = document.getElementById("transcript");
    const wordCountEl = document.getElementById("wordCount");
    const timerEl = document.getElementById("timer");
    const statusEl = document.getElementById("status");
    const evaluateBtn = document.getElementById("evaluateBtn");

    let recognition = null;
    let isRecording = false;
    let timerInterval = null;
    let secondsElapsed = 0;

    // Helper: update word count display
    function getWords(text) {
        if (!text || !text.trim()) return [];
        return text.trim().split(/\s+/).filter(Boolean);
    }

    function updateWordCount(text) {
        const words = getWords(text);
        if (wordCountEl) {
            wordCountEl.textContent = words.length;
        }
    }

    // Helper: timer format MM:SS
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }

    function startTimer() {
        stopTimer();
        secondsElapsed = 0;
        timerEl.textContent = "00:00";
        timerInterval = setInterval(() => {
            secondsElapsed++;
            timerEl.textContent = formatTime(secondsElapsed);
        }, 1000);
    }

    function stopTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    // Real-time word count when typing/pasting
    if (transcriptBox) {
        transcriptBox.addEventListener("input", (e) => {
            updateWordCount(e.target.value);
        });
    }

    // Speech Recognition Setup
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onresult = (event) => {
            let finalTranscript = "";
            for (let i = 0; i < event.results.length; i++) {
                finalTranscript += event.results[i][0].transcript + " ";
            }
            transcriptBox.value = finalTranscript.trim();
            updateWordCount(transcriptBox.value);
        };

        recognition.onerror = (event) => {
            console.warn("Speech recognition error:", event.error);
            if (statusEl) statusEl.textContent = `Speech recognition notice: ${event.error}`;
            if (isRecording) {
                stopRecording();
            }
        };

        recognition.onend = () => {
            if (isRecording) {
                // If stopped unexpectedly while still flagged as recording, reset UI
                stopRecording();
            }
        };
    } else {
        recordBtn.disabled = true;
        recordBtn.textContent = "🎤 Speech recognition not supported in this browser";
    }

    function startRecording() {
        if (!recognition) return;
        try {
            recognition.start();
            isRecording = true;
            recordBtn.textContent = "⏹ Stop Speaking";
            recordBtn.style.backgroundColor = "#dc2626";
            if (statusEl) statusEl.textContent = "Listening... Speak into your microphone.";
            startTimer();
        } catch (err) {
            console.error("Failed to start speech recognition:", err);
        }
    }

    function stopRecording() {
        if (recognition && isRecording) {
            recognition.stop();
        }
        isRecording = false;
        recordBtn.textContent = "🎤 Start Speaking";
        recordBtn.style.backgroundColor = "";
        stopTimer();
        if (statusEl) statusEl.textContent = "";
    }

    recordBtn.addEventListener("click", () => {
        if (!isRecording) {
            startRecording();
        } else {
            stopRecording();
        }
    });

    // Evaluate Speech
    evaluateBtn.addEventListener("click", async () => {
        if (isRecording) {
            stopRecording();
        }

        const text = transcriptBox.value.trim();
        const words = getWords(text);

        if (!text) {
            if (statusEl) statusEl.textContent = "Please speak or enter some text first.";
            return;
        }

        if (words.length < 5) {
            if (statusEl) statusEl.textContent = "Please provide at least 5-10 words for a meaningful evaluation.";
            return;
        }

        if (statusEl) statusEl.textContent = "Evaluating your speech with Gemini AI... Please wait.";
        evaluateBtn.disabled = true;

        try {
            const currentToken = localStorage.getItem("token");
            const response = await fetch("/api/evaluate", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${currentToken}`
                },
                body: JSON.stringify({ text })
            });

            const data = await response.json();

            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem("token");
                window.location.href = "/auth.html";
                return;
            }

            if (!response.ok) {
                if (statusEl) statusEl.textContent = data.error || data.message || "Evaluation failed.";
                evaluateBtn.disabled = false;
                return;
            }

            if (statusEl) statusEl.textContent = "";
            showResult(data);
        } catch (err) {
            console.error("Evaluation request error:", err);
            if (statusEl) statusEl.textContent = "An error occurred while evaluating. Please try again.";
        } finally {
            evaluateBtn.disabled = false;
        }
    });

    function showResult(data) {
        const practiceSection = document.getElementById("practiceSection");
        const resultSection = document.getElementById("resultSection");

        if (practiceSection) practiceSection.classList.add("hidden");
        if (resultSection) resultSection.classList.remove("hidden");

        const overallEl = document.getElementById("overallScore");
        const grammarEl = document.getElementById("grammarScore");
        const vocabEl = document.getElementById("vocabularyScore");
        const suggestionsEl = document.getElementById("suggestions");

        if (overallEl) overallEl.textContent = data.overallScore ?? "--";
        if (grammarEl) grammarEl.textContent = data.grammarScore ?? "--";
        if (vocabEl) vocabEl.textContent = data.vocabularyScore ?? "--";

        if (suggestionsEl) {
            suggestionsEl.style.whiteSpace = "pre-line";
            suggestionsEl.textContent = data.suggestions || "Great practice!";
        }
    }

    // Try Again Handler
    const tryAgainBtn = document.getElementById("tryAgainBtn");
    if (tryAgainBtn) {
        tryAgainBtn.addEventListener("click", () => {
            const practiceSection = document.getElementById("practiceSection");
            const resultSection = document.getElementById("resultSection");

            if (resultSection) resultSection.classList.add("hidden");
            if (practiceSection) practiceSection.classList.remove("hidden");

            transcriptBox.value = "";
            updateWordCount("");
            stopTimer();
            secondsElapsed = 0;
            if (timerEl) timerEl.textContent = "00:00";
            if (statusEl) statusEl.textContent = "";
        });
    }
}


// ============================
// LOGOUT LOGIC
// ============================

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/auth.html";
    });
}