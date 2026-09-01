

const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const switchBtn = document.getElementById("switchBtn");

if (loginForm) {

    let signupMode = false;

    switchBtn.addEventListener("click", () => {

        signupMode = !signupMode;

        loginForm.classList.toggle("hidden");
        signupForm.classList.toggle("hidden");

        document.getElementById("authTitle").textContent =
            signupMode ? "Create your account" : "Welcome back";

        document.getElementById("switchText").textContent =
            signupMode
                ? "Already have an account?"
                : "Don't have an account?";

        switchBtn.textContent =
            signupMode ? "Login" : "Sign up";
    });


    // Login

    loginForm.addEventListener("submit", async (e) => {

        e.preventDefault();

        const email = document.getElementById("loginEmail").value;
        const password = document.getElementById("loginPassword").value;

        const response = await fetch("/api/login", {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                email,
                password
            })
        });

        const data = await response.json();

        if (response.ok) {

            localStorage.setItem("token", data.token);

            window.location.href = "/";

        } else {

            document.getElementById("authMessage").textContent =
                data.message || "Login failed";
        }
    });


    // Signup

    signupForm.addEventListener("submit", async (e) => {

        e.preventDefault();

        const name = document.getElementById("signupName").value;
        const email = document.getElementById("signupEmail").value;
        const password = document.getElementById("signupPassword").value;

        const response = await fetch("/api/signup", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                name,
                email,
                password
            })
        });

        const data = await response.json();

        if (response.ok) {

            alert("Account created. Please login.");

            switchBtn.click();

        } else {

            document.getElementById("authMessage").textContent =
                data.message || "Signup failed";
        }
    });
}


// ============================
// MAIN PAGE
// ============================

const recordBtn = document.getElementById("recordBtn");

if (recordBtn) {

    const transcriptBox = document.getElementById("transcript");
    const wordCount = document.getElementById("wordCount");

    let recognition;
    let recording = false;

    // Speech recognition

    if ("webkitSpeechRecognition" in window) {

        recognition = new webkitSpeechRecognition();

        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onresult = (event) => {

            let text = "";

            for (
                let i = 0;
                i < event.results.length;
                i++
            ) {
                text += event.results[i][0].transcript;
            }

            transcriptBox.value = text;

            updateWordCount(text);
        };

    } else {

        recordBtn.disabled = true;

        recordBtn.textContent =
            "Speech recognition not supported";
    }


    recordBtn.addEventListener("click", () => {

        if (!recording) {

            recognition.start();

            recording = true;

            recordBtn.textContent =
                "⏹ Stop Speaking";

        } else {

            recognition.stop();

            recording = false;

            recordBtn.textContent =
                "🎤 Start Speaking";
        }

    });


    function updateWordCount(text) {

        const words = text
            .trim()
            .split(/\s+/)
            .filter(Boolean);

        wordCount.textContent = words.length;
    }


    // Evaluate

    document
        .getElementById("evaluateBtn")
        .addEventListener("click", async () => {

            const text = transcriptBox.value.trim();

            if (!text) {

                document.getElementById("status").textContent =
                    "Please speak something first.";

                return;
            }

            const words = text.split(/\s+/).length;

            if (words < 100 || words > 200) {

                document.getElementById("status").textContent =
                    "Your speech should contain 100–200 words.";

                return;
            }

            document.getElementById("status").textContent =
                "Evaluating...";

            const token = localStorage.getItem("token");

            const response = await fetch("/api/evaluate", {

                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },

                body: JSON.stringify({
                    text
                })
            });

            const data = await response.json();

            if (!response.ok) {

                document.getElementById("status").textContent =
                    data.message || "Evaluation failed.";

                return;
            }

            showResult(data);
        });


    function showResult(data) {

        document
            .getElementById("practiceSection")
            .classList.add("hidden");

        document
            .getElementById("resultSection")
            .classList.remove("hidden");

        document.getElementById("overallScore").textContent =
            data.overallScore;

        document.getElementById("grammarScore").textContent =
            data.grammarScore;

        document.getElementById("vocabularyScore").textContent =
            data.vocabularyScore;

        document.getElementById("suggestions").textContent =
            data.suggestions;
    }


    // Try again

    document
        .getElementById("tryAgainBtn")
        .addEventListener("click", () => {

            document
                .getElementById("resultSection")
                .classList.add("hidden");

            document
                .getElementById("practiceSection")
                .classList.remove("hidden");

            transcriptBox.value = "";

            wordCount.textContent = "0";

            document.getElementById("status").textContent = "";
        });
}


// ============================
// LOGOUT
// ============================

const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {

    logoutBtn.addEventListener("click", () => {

        localStorage.removeItem("token");

        window.location.href = "/auth.html";
    });
}