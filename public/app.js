
const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const switchBtn = document.getElementById("switchBtn");
const authMessage = document.getElementById("authMessage");

if (loginForm && signupForm && switchBtn) {
    let signupMode = false;

    
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

const recordBtn = document.getElementById("recordBtn");

if (recordBtn) {
    const token = localStorage.getItem("token");

    if (!token) {
        window.location.href = "/auth.html";
    }

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

    // Audio & Speech Recording Setup
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let initialTranscript = "";
    let userRequestedStop = false;
    let mediaRecorder = null;
    let audioStream = null;
    let audioChunks = [];
    let recordedAudioBase64 = null;
    let recordedMimeType = "audio/webm";

    function initSpeechRecognition() {
        if (!SpeechRecognition) return null;
        const sr = new SpeechRecognition();
        sr.continuous = true;
        sr.interimResults = true;
        sr.lang = "en-US";
        sr.maxAlternatives = 1;

        sr.onresult = (event) => {
            let sessionTranscript = "";
            for (let i = 0; i < event.results.length; i++) {
                sessionTranscript += event.results[i][0].transcript + " ";
            }

            const prefix = initialTranscript ? initialTranscript + " " : "";
            transcriptBox.value = (prefix + sessionTranscript).replace(/\s+/g, ' ').trim();
            updateWordCount(transcriptBox.value);
            if (statusEl && isRecording) {
                statusEl.textContent = "🗣️ Live transcribing...";
            }
        };

        sr.onerror = (event) => {
            console.warn("SpeechRecognition notice:", event.error);
            if (event.error === 'network') {
                if (statusEl && isRecording) {
                    statusEl.textContent = "🎙️ Recording your voice directly... (Gemini will transcribe and evaluate)";
                }
                return;
            }
            if (event.error === 'no-speech') {
                return;
            }
        };

        sr.onend = () => {
            if (isRecording && !userRequestedStop) {
                try {
                    sr.start();
                } catch (e) {}
            }
        };

        return sr;
    }

    async function startRecording() {
        userRequestedStop = false;
        recordedAudioBase64 = null;
        audioChunks = [];
        initialTranscript = transcriptBox.value ? transcriptBox.value.trim() : "";

        // Start browser microphone stream & MediaRecorder
        try {
            audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            const mimeOptions = ["audio/webm", "audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"];
            recordedMimeType = mimeOptions.find(type => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(type)) || "";

            mediaRecorder = recordedMimeType 
                ? new MediaRecorder(audioStream, { mimeType: recordedMimeType })
                : new MediaRecorder(audioStream);

            mediaRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    audioChunks.push(e.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: recordedMimeType || "audio/webm" });
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = async () => {
                    const base64data = reader.result;
                    recordedAudioBase64 = base64data.split(',')[1];

                    // Automatically transcribe and place text in the textbox!
                    if (statusEl) {
                        statusEl.textContent = "Transcribing your speech with Gemini AI...";
                    }
                    if (transcriptBox && !transcriptBox.value.trim()) {
                        transcriptBox.placeholder = "Transcribing your speech with Gemini AI... Please wait a moment.";
                    }

                    try {
                        const currentToken = localStorage.getItem("token");
                        const res = await fetch("/api/transcribe", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": `Bearer ${currentToken}`
                            },
                            body: JSON.stringify({
                                audio: recordedAudioBase64,
                                mimeType: recordedMimeType || "audio/webm"
                            })
                        });

                        const data = await res.json();
                        if (transcriptBox) {
                            transcriptBox.placeholder = "Your speech will appear here...";
                        }

                        if (data && data.transcript) {
                            const prefix = initialTranscript ? initialTranscript + " " : "";
                            transcriptBox.value = (prefix + data.transcript).trim();
                            updateWordCount(transcriptBox.value);
                            if (statusEl) {
                                statusEl.textContent = "Speech transcribed! Review above or click 'Evaluate Speech'.";
                            }
                        } else if (statusEl) {
                            statusEl.textContent = "Voice captured! Click 'Evaluate Speech' to evaluate.";
                        }
                    } catch (transcribeErr) {
                        console.warn("Auto-transcription error:", transcribeErr);
                        if (transcriptBox) {
                            transcriptBox.placeholder = "Your speech will appear here...";
                        }
                        if (statusEl) {
                            statusEl.textContent = "Voice captured! Click 'Evaluate Speech' to evaluate.";
                        }
                    }
                };
            };

            mediaRecorder.start(250); 

        } catch (err) {
            console.error("Microphone access error:", err);
            if (statusEl) {
                statusEl.textContent = "Could not access microphone. Please check your browser microphone permissions.";
            }
            return;
        }

        // Also start WebSpeech live preview if available
        if (SpeechRecognition) {
            try {
                if (!recognition) {
                    recognition = initSpeechRecognition();
                }
                recognition.start();
            } catch (e) {
                console.warn("Live Speech preview note:", e);
            }
        }

        isRecording = true;
        recordBtn.textContent = "⏹ Stop Speaking";
        recordBtn.style.backgroundColor = "#dc2626";
        if (statusEl) statusEl.textContent = "🎤 Listening & Recording audio... Speak into your microphone.";
        startTimer();
    }

    function stopRecording() {
        userRequestedStop = true;
        isRecording = false;

        if (mediaRecorder && mediaRecorder.state !== "inactive") {
            try {
                mediaRecorder.stop();
            } catch (err) {
                console.warn("Error stopping mediaRecorder:", err);
            }
        }

        if (audioStream) {
            audioStream.getTracks().forEach(track => track.stop());
            audioStream = null;
        }

        if (recognition) {
            try {
                recognition.stop();
            } catch (err) {
                console.warn("Error stopping recognition:", err);
            }
        }

        recordBtn.textContent = "🎤 Start Speaking";
        recordBtn.style.backgroundColor = "";
        stopTimer();

        if (statusEl && (statusEl.textContent.includes("Listening") || statusEl.textContent.includes("Live"))) {
            statusEl.textContent = "Recording stopped. Click 'Evaluate Speech' to evaluate.";
        }
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

        if (!text && !recordedAudioBase64) {
            if (statusEl) statusEl.textContent = "Please speak or type some text first.";
            return;
        }

        if (statusEl) statusEl.textContent = "Evaluating your speech with Gemini AI... Please wait.";
        evaluateBtn.disabled = true;

        try {
            const currentToken = localStorage.getItem("token");
            const payload = {};

            if (recordedAudioBase64) {
                payload.audio = recordedAudioBase64;
                payload.mimeType = recordedMimeType || "audio/webm";
            }
            if (text) {
                payload.text = text;
            }

            const response = await fetch("/api/evaluate", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${currentToken}`
                },
                body: JSON.stringify(payload)
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

            if (data.transcript) {
                transcriptBox.value = data.transcript;
                updateWordCount(data.transcript);
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
        const resultTranscriptEl = document.getElementById("resultTranscript");

        if (resultTranscriptEl) {
            resultTranscriptEl.textContent = data.transcript || transcriptBox.value || "Audio recording evaluated successfully.";
        }

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
            initialTranscript = "";
            recordedAudioBase64 = null;
            audioChunks = [];
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