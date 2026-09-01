const { GoogleGenerativeAI } = require("@google/generative-ai");
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model:"gemini-2.5-flash" });

async function analyzeWithGemini(prompt) {
    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;

        return response.text();

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        return null;
    }
}

module.exports = {
    analyzeWithGemini
};