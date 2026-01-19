import { requestUrl } from "obsidian";

export class AIService {

    static async callGoogle(apiKey: string, model: string, systemPrompt: string, userPrompt: string): Promise<string> {
        if (!apiKey) throw new Error("Google API Key is missing");
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
        const body = {
            contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }]
        };
        const resp = await requestUrl({
            url: url,
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
            body: JSON.stringify(body)
        });
        if (resp.status !== 200) throw new Error(`Gemini Error ${resp.status}: ${resp.text}`);
        if (!resp.json.candidates || !resp.json.candidates[0].content) throw new Error("AI returned no content");
        return resp.json.candidates[0].content.parts[0].text;
    }

    static async callOpenAI(apiKey: string, model: string, systemPrompt: string, userPrompt: string): Promise<string> {
        if (!apiKey) throw new Error("OpenAI API Key is missing");
        const url = "https://api.openai.com/v1/chat/completions";
        const body = {
            model: model,
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }]
        };
        const resp = await requestUrl({
            url: url,
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
            body: JSON.stringify(body)
        });
        if (resp.status >= 400) throw new Error(`OpenAI Error: ${resp.status}`);
        return resp.json.choices[0].message.content;
    }

    static async callAnthropic(apiKey: string, model: string, systemPrompt: string, userPrompt: string): Promise<string> {
        if (!apiKey) throw new Error("Anthropic API Key is missing");
        const url = "https://api.anthropic.com/v1/messages";
        const body = {
            model: model,
            system: systemPrompt,
            messages: [{ role: "user", content: userPrompt }],
            max_tokens: 4096
        };
        const resp = await requestUrl({
            url: url,
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
            body: JSON.stringify(body)
        });
        if (resp.status >= 400) throw new Error(`Claude Error: ${resp.status}`);
        return resp.json.content[0].text;
    }
}
