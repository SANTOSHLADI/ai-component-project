require('dotenv').config();
const axios = require('axios');
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const User = require('./models/User');
const Session = require('./models/Session');
const authMiddleware = require('./middleware/auth');

const app = express();
app.use(cors());
app.use(express.json());

// Make sure your MONGO_URI is correct and the password is URL-encoded if needed
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://ladi60143:Santosh123@cluster0.2kudmcu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_and_long_jwt_key_that_is_hard_to_guess';

mongoose.connect(MONGO_URI).then(() => console.log('MongoDB connected')).catch(err => console.error("MongoDB connection error:", err.message));

// --- AUTHENTICATION ROUTES ---
app.post('/api/auth/signup', async (req, res) => { try { const { email, password } = req.body; const existingUser = await User.findOne({ email }); if (existingUser) { return res.status(400).json({ message: 'User already exists.' }); } const hashedPassword = await bcrypt.hash(password, 12); const newUser = new User({ email, password: hashedPassword }); await newUser.save(); res.status(201).json({ message: 'User created successfully.' }); } catch (error) { res.status(500).json({ message: 'Something went wrong.' }); } });
app.post('/api/auth/login', async (req, res) => { try { const { email, password } = req.body; const user = await User.findOne({ email }); if (!user) { return res.status(404).json({ message: 'User not found.' }); } const isMatch = await bcrypt.compare(password, user.password); if (!isMatch) { return res.status(400).json({ message: 'Invalid credentials.' }); } const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' }); res.status(200).json({ token }); } catch (error) { res.status(500).json({ message: 'Something went wrong.' }); } });

// --- AI GENERATION ROUTE ---
app.post('/api/generate/component', async (req, res) => {
  const { prompt, currentJsx, currentCss } = req.body;

  // ⭐ THIS IS THE FINAL, MOST ROBUST PROMPT
  const systemPrompt = `
    You are an expert React and CSS developer. Your task is to return a raw JSON object with "jsx" and "css" keys.
    - The "jsx" value must be a string of complete, valid, and syntactically correct JSX code for a single React functional component.
    - CRITICAL: The response MUST be a valid React component.
    - CRITICAL: All import statements must be on separate lines.
    - CRITICAL: All self-closing HTML tags like <input>, <img>, or <br> MUST be correctly closed with a trailing slash (e.g., <input ... />). This is a strict requirement.
    - CRITICAL: You MUST use standard CSS with classNames. Do NOT use styled-components, emotion, or any other CSS-in-JS libraries or inline style objects. All CSS must be returned in the "css" field.
    - The "css" value must be a string of all necessary CSS that corresponds to the classNames used in the JSX.
    - If the user provides existing JSX and CSS to modify, you MUST modify the existing code, not regenerate it.
    - Ensure your entire response is only the raw JSON object. Do not include any other text or markdown.
  `;
  
  let userPrompt;
  if (currentJsx && currentCss) {
    userPrompt = `Here is the existing code:\nJSX:\n\`\`\`jsx\n${currentJsx}\n\`\`\`\nCSS:\n\`\`\`css\n${currentCss}\n\`\`\`\nNow, please apply this change: ${prompt}`;
  } else {
    userPrompt = prompt;
  }

  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "mistralai/mistral-7b-instruct-v0.2",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        response_format: { type: "json_object" },
      },
      {
        headers: { "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}` },
        timeout: 30000 
      }
    );

    if (response.data?.choices?.[0]?.message?.content) {
      const jsonResponseString = response.data.choices[0].message.content;
      const generatedCode = JSON.parse(jsonResponseString);
      res.status(200).json(generatedCode);
    } else {
      throw new Error("AI response is missing the expected content.");
    }

  } catch (error) {
    console.error("Error calling AI API or parsing response:", error.message);
    res.status(500).json({ message: "Failed to generate component from AI." });
  }
});

// --- SESSION MANAGEMENT ROUTES ---
app.get('/api/sessions', authMiddleware, async (req, res) => { try { const sessions = await Session.find({ user: req.userData.userId }).sort({ lastUpdatedAt: -1 }).select('_id lastUpdatedAt'); res.status(200).json(sessions); } catch (error) { res.status(500).json({ message: 'Fetching sessions failed.' }); } });
app.get('/api/sessions/:id', authMiddleware, async (req, res) => { try { const session = await Session.findOne({ _id: req.params.id, user: req.userData.userId }); if (!session) { return res.status(404).json({ message: 'Session not found.' }); } res.status(200).json(session); } catch (error) { res.status(500).json({ message: 'Fetching session data failed.' }); } });
app.post('/api/sessions/save', authMiddleware, async (req, res) => { try { const { messages, generatedCode, sessionId } = req.body; const userId = req.userData.userId; if (sessionId) { const updatedSession = await Session.findByIdAndUpdate(sessionId, { messages, generatedCode, lastUpdatedAt: Date.now() }, { new: true }); return res.status(200).json({ message: 'Session updated.', session: updatedSession }); } else { const newSession = new Session({ user: userId, messages, generatedCode }); await newSession.save(); return res.status(201).json({ message: 'Session saved.', session: newSession }); } } catch (error) { res.status(500).json({ message: 'Failed to save session.' }); } });

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
