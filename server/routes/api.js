const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const { analyzeWithGemini } = require("../services/gemini");
const users = [];

router.post('/evaluate', async (req, res) => {
     try {
        const { text } = req.body;

        if (!text) {
            return res.status(400).json({
                error: "Text is required"
            });
        }


    const prompt = `
            Evaluate the following English speech.

            Speech:
            "${text}"

            Give the response in this format:

            Grammar Score: /100
            Vocabulary Score: /100
            Overall Score: /100

            Suggestions:
            - suggestion 1
            - suggestion 2
            - suggestion 3
            `;
    
        const result = await analyzeWithGemini(prompt);

        if (!result) {
            return res.status(500).json({
                error: "Gemini evaluation failed"
            });
        }

        res.json({
            success: true,
            result: result
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Something went wrong"
        });
    }
});


router.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                error: "Username and password are required"
            });
        }
        const existingUser = users.find(
            user => user.username === username
        );

        if (existingUser) {
            return res.status(409).json({
                error: "Username already exists"
            });
        }
        const hashedPassword = await bcrypt.hash(password, 10);

        users.push({
            id: users.length + 1,
            username,
            password: hashedPassword
        });

        res.status(201).json({
            message: "Registration successful"
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Registration failed"
        });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = users.find(
            user => user.username === username
        );

        if (!user) {
            return res.status(401).json({
                error: "Invalid credentials"
            });
        }

        const match = await bcrypt.compare(
            password,
            user.password
        );

        if (!match) {
            return res.status(401).json({
                error: "Invalid credentials"
            });
        }

        const accessToken = jwt.sign(
            {
                id: user.id,
                username: user.username
            },
            process.env.TOKEN_SECRET,
            {
                expiresIn: "1h"
            }
        );

        res.json({
            message: "Login successful",
            accessToken
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Login failed"
        });
    }
});


module.exports = router;
