const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model:"gemini-2.5-flash" });
app.get("/", (req, res) => {
    res.send("Server is running. Use the /validate endpoints.");
});

async function analyzeWithGemini(prompt) {
    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Error calling Gemini API", error);
        return null;
    }
}