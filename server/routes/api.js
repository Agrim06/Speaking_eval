const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const { analyzeWithGemini } = require("../services/gemini");


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
        const hashedPassword = await bcrypt.hash(req.body.password, 10);

        const user = new User({
            username: req.body.username,
            password: hashedPassword,
        });
        const savedUser = await user.save();
        res.json(savedUser);
    } catch(e) {
        res.json({ message: "Error"});
    }
});

router.post('/login', async (req, res) => {
    const user = await User.findOne({ username: req.body.username });

    try{
        const match = await bcrypt.compare(req.body.password, user.password);
        const accessToken = jwt.sign(JSON.stringify(user), process.env.TOKEN_SECRET)
        if(match){
            res.json({ accessToken: accessToken });
        } else {
            res.json({ message: "Invalid Credentials" });
        }
    } catch(e) {
        console.log(e)
    }
});



module.exports = router;
