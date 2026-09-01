const { GoogleGenerativeAI } = require("@google/generative-ai");

function getModel() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not configured in environment variables");
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        generationConfig: {
            responseMimeType: "application/json"
        }
    });
}

async function analyzeWithGemini(contents) {
    try {
        const model = getModel();
        const result = await model.generateContent(contents);
        const response = await result.response;
        const text = response.text();
        return JSON.parse(text);
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        return null;
    }
}

module.exports = {
    analyzeWithGemini
};