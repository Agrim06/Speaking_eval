const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const { analyzeWithGemini } = require("../services/gemini");
const users = [];

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: "Access token required" });
    }

    jwt.verify(token, process.env.TOKEN_SECRET || 'default_secret', (err, user) => {
        if (err) {
            return res.status(403).json({ error: "Invalid or expired token" });
        }
        req.user = user;
        next();
    });
}

// User Profile
router.get('/me', authenticateToken, (req, res) => {
    const user = users.find(u => u.id === req.user.id);
    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }
    res.json({
        id: user.id,
        name: user.name || user.username,
        email: user.email,
        username: user.username
    });
});

// Evaluation (supports both direct audio recording and text transcript)
router.post('/evaluate', authenticateToken, async (req, res) => {
    try {
        const { text, audio, mimeType } = req.body;

        if (!text && !audio) {
            return res.status(400).json({
                error: "Please provide speech audio or text to evaluate"
            });
        }

        let prompt;
        let contents;

        if (audio) {
            prompt = `
You are an expert English language proficiency evaluator and transcriber.
Listen carefully to the attached speech audio recording.

Tasks:
1. Transcribe the spoken speech accurately into "transcript".
2. Assess the spoken English quality (grammar, vocabulary, clarity, relevance).
3. Provide scores out of 100 and helpful bulleted improvement suggestions.

Format strictly as a JSON object:
{
  "transcript": "Exact transcription of what was spoken",
  "overallScore": 85,
  "grammarScore": 80,
  "vocabularyScore": 90,
  "suggestions": "- Suggestion 1\\n- Suggestion 2"
}
`;
            contents = [
                prompt,
                {
                    inlineData: {
                        data: audio,
                        mimeType: mimeType || "audio/webm"
                    }
                }
            ];
        } else {
            prompt = `
You are an expert English language proficiency evaluator. Evaluate the following spoken English transcript.

Transcript:
"${text.trim()}"

Provide an accurate assessment formatted strictly as a JSON object with the following fields:
- "transcript": "${text.trim().replace(/"/g, '\\"')}",
- "overallScore": integer between 0 and 100 representing overall quality.
- "grammarScore": integer between 0 and 100 for grammatical accuracy and complexity.
- "vocabularyScore": integer between 0 and 100 for lexical resource and variety.
- "suggestions": a string with 2-4 concise, bulleted feedback points (e.g. "- Suggestion 1\\n- Suggestion 2") for improvement.

JSON schema:
{
  "transcript": "${text.trim().replace(/"/g, '\\"')}",
  "overallScore": 85,
  "grammarScore": 80,
  "vocabularyScore": 90,
  "suggestions": "- Suggestion 1\\n- Suggestion 2"
}
`;
            contents = prompt;
        }

        const result = await analyzeWithGemini(contents);

        if (!result) {
            return res.status(500).json({
                error: "Gemini evaluation failed. Please verify your API key and try again."
            });
        }

        const overallScore = result.overallScore !== undefined ? result.overallScore : (result.overall || 75);
        const grammarScore = result.grammarScore !== undefined ? result.grammarScore : (result.grammar || 75);
        const vocabularyScore = result.vocabularyScore !== undefined ? result.vocabularyScore : (result.vocabulary || 75);
        const transcript = result.transcript || text || "";
        let suggestions = result.suggestions;
        if (Array.isArray(suggestions)) {
            suggestions = suggestions.map(s => (s.startsWith('-') ? s : `- ${s}`)).join('\n');
        } else if (!suggestions) {
            suggestions = "Great effort! Keep practicing to improve flow and sentence structure.";
        }

        res.json({
            success: true,
            transcript,
            overallScore,
            grammarScore,
            vocabularyScore,
            suggestions
        });

    } catch (error) {
        console.error("Evaluation error:", error);
        res.status(500).json({
            error: "Something went wrong during evaluation"
        });
    }
});

// Registration handler for both /register and /signup
async function handleRegister(req, res) {
    try {
        const { username, name, email, password } = req.body;
        const userIdentifier = email || username || name;
        const displayName = name || username || (email ? email.split('@')[0] : 'User');

        if (!userIdentifier || !password) {
            return res.status(400).json({
                error: "Email/username and password are required"
            });
        }

        const existingUser = users.find(
            user => (email && user.email === email) || (username && user.username === username) || (user.username === userIdentifier)
        );

        if (existingUser) {
            return res.status(409).json({
                error: "User already exists with that email or username"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = {
            id: users.length + 1,
            name: displayName,
            username: username || userIdentifier,
            email: email || userIdentifier,
            password: hashedPassword
        };

        users.push(newUser);

        res.status(201).json({
            message: "Registration successful"
        });

    } catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({
            error: "Registration failed"
        });
    }
}

router.post('/register', handleRegister);
router.post('/signup', handleRegister);

// Login handler
router.post('/login', async (req, res) => {
    try {
        const { email, username, password } = req.body;
        const identifier = email || username;

        if (!identifier || !password) {
            return res.status(400).json({
                error: "Email/username and password are required"
            });
        }

        const user = users.find(
            u => u.email === identifier || u.username === identifier
        );

        if (!user) {
            return res.status(401).json({
                error: "Invalid credentials"
            });
        }

        const match = await bcrypt.compare(password, user.password);

        if (!match) {
            return res.status(401).json({
                error: "Invalid credentials"
            });
        }

        const tokenSecret = process.env.TOKEN_SECRET || 'default_secret';
        const accessToken = jwt.sign(
            {
                id: user.id,
                username: user.username,
                email: user.email,
                name: user.name
            },
            tokenSecret,
            {
                expiresIn: "7d"
            }
        );

        res.json({
            message: "Login successful",
            token: accessToken,
            accessToken,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                username: user.username
            }
        });

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({
            error: "Login failed"
        });
    }
});

module.exports = router;
