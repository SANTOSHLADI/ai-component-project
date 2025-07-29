const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const sessionSchema = new Schema({
  // Link the session to a specific user
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User', // This refers to the 'User' model we already have
    required: true,
  },
  // Store the entire chat history
  messages: [
    {
      sender: { type: String, required: true }, // 'user' or 'ai'
      text: { type: String, required: true },
    },
  ],
  // Store the generated code
  generatedCode: {
    jsx: { type: String },
    css: { type: String },
  },
  // Track when the session was last updated
  lastUpdatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Session', sessionSchema);
