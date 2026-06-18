const AIService = {
  /**
   * Parse voice intent using Groq API
   * @param {string} transcript The voice input text
   * @param {string} apiKey The Groq API Key
   * @returns {Promise<Object>} JSON containing intent details
   */
  async parseVoiceIntent(transcript, apiKey) {
    
    const prompt = `
You are an intelligent music assistant inside a web music player app.
Analyze the user's voice transcript and extract their intent.
The transcript is: "${transcript}"

Return ONLY a raw JSON object with no markdown formatting or extra text.
The JSON should follow this structure:
{
  "type": "search" | "playlist",
  "query": "the extracted search term or playlist theme",
  "playImmediate": boolean // true if they said "play X", false if just "find X" or "search X"
}
Examples:
- "Play some upbeat synthwave" -> {"type": "playlist", "query": "upbeat synthwave", "playImmediate": true}
- "Search for Blinding Lights by The Weeknd" -> {"type": "search", "query": "Blinding Lights The Weeknd", "playImmediate": false}
- "Play latest songs of Taylor Swift" -> {"type": "search", "query": "latest songs of Taylor Swift", "playImmediate": true}
`;

    return this._callGroq(prompt, apiKey);
  },

  /**
   * Generate a playlist of 5-10 songs based on a prompt
   * @param {string} prompt User's playlist prompt
   * @param {string} apiKey The Groq API Key
   * @returns {Promise<Object>} JSON containing an array of song queries
   */
  async generatePlaylistFromPrompt(prompt, apiKey) {

    const sysPrompt = `
You are an expert music curator. 
The user wants a playlist based on this prompt: "${prompt}"

Generate a list of exactly 8 real, popular songs that perfectly match this vibe or theme.
Return ONLY a raw JSON object with no markdown formatting.
Format:
{
  "title": "A creative title for this playlist (e.g. 'Rainy Day Jazz')",
  "description": "A short, engaging description for this playlist.",
  "songs": [
    "Song Name - Artist Name",
    "Another Song - Artist"
  ]
}
`;

    return this._callGroq(sysPrompt, apiKey);
  },

  async _callGroq(prompt, apiKey) {
    const url = `/api/groq/openai/v1/chat/completions`;
    
    try {
      const headers = {
        'Content-Type': 'application/json'
      };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Groq API Error:", errorText);
        let detail = "Please check your API key.";
        try {
          const errObj = JSON.parse(errorText);
          if (errObj.error && errObj.error.message) {
            detail = errObj.error.message;
          }
        } catch(e) {}
        throw new Error("AI Error: " + detail);
      }

      const data = await response.json();
      const rawText = data.choices[0].message.content;
      
      // Sometimes models might still include markdown blocks despite instructions, so we clean it.
      const cleanedText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      
      return JSON.parse(cleanedText);
    } catch (err) {
      console.error(err);
      throw err;
    }
  }
};

window.AIService = AIService;
