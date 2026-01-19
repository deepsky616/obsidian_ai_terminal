import { ItemView, WorkspaceLeaf, Notice, TFile, setIcon, ButtonComponent } from "obsidian";
import AITerminalPlugin from "../main";
import { AIService } from "./AIService";
import { NoteSuggester } from "./NoteSuggester";

export const TERMINAL_VIEW_TYPE = "ai-terminal-view";

interface ChatMessage {
    role: 'user' | 'ai' | 'system';
    content: string;
}

export class TerminalView extends ItemView {
    plugin: AITerminalPlugin;
    pinnedNotes: TFile[] = [];
    chatHistory: ChatMessage[] = [];
    currentModel: 'google' | 'openai' | 'anthropic' = 'google'; // Default

    constructor(leaf: WorkspaceLeaf, plugin: AITerminalPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType() {
        return TERMINAL_VIEW_TYPE;
    }

    getDisplayText() {
        return "AI Terminal";
    }

    getIcon() {
        return "terminal";
    }

    async onOpen() {
        this.render();
    }

    render() {
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass("ai-terminal-container");

        // 1. Header (Model Selector)
        const header = container.createDiv({ cls: "ai-terminal-header" });
        header.createEl("span", { text: "TERMINAL SESSION", cls: "ai-terminal-title" });

        const modelSelect = header.createEl("select", { cls: "dropdown" });
        const options = [
            { value: 'google', text: '✨ Gemini 2.0' },
            { value: 'openai', text: '🟢 GPT-4o' },
            { value: 'anthropic', text: '✴️ Claude 3.5' }
        ];
        options.forEach(opt => {
            const el = modelSelect.createEl("option", { value: opt.value, text: opt.text });
            if (this.currentModel === opt.value) el.selected = true;
        });
        modelSelect.onchange = (e) => {
            this.currentModel = (e.target as HTMLSelectElement).value as any;
            new Notice(`Model switched to ${this.currentModel}`);
        };

        // 2. Context Section
        const contextDiv = container.createDiv({ cls: "ai-terminal-context" });
        const contextHeader = contextDiv.createDiv({ cls: "context-header" });
        contextHeader.createEl("strong", { text: `📌 PINNED CONTEXT (${this.pinnedNotes.length})` });

        const addButton = new ButtonComponent(contextHeader)
            .setIcon("plus")
            .setTooltip("Pin Note")
            .onClick(() => {
                new NoteSuggester(this.app, (file) => {
                    if (!this.pinnedNotes.includes(file)) {
                        this.pinnedNotes.push(file);
                        this.render();
                        new Notice(`Pinned: ${file.basename}`);
                    }
                }).open();
            });

        const pinnedList = contextDiv.createDiv({ cls: "pinned-list" });
        this.pinnedNotes.forEach(file => {
            const item = pinnedList.createDiv({ cls: "pinned-item" });
            item.createEl("span", { text: file.basename });
            const removeBtn = item.createEl("span", { cls: "remove-btn", text: "✖" });
            removeBtn.onclick = () => {
                this.pinnedNotes = this.pinnedNotes.filter(f => f !== file);
                this.render();
            };
        });

        // 3. Chat Area
        const chatArea = container.createDiv({ cls: "ai-terminal-chat" });
        this.chatHistory.forEach(msg => {
            const msgDiv = chatArea.createDiv({ cls: `chat-message ${msg.role}` });
            msgDiv.createEl("strong", { text: msg.role.toUpperCase() });
            msgDiv.createEl("div", { text: msg.content, cls: "message-content" });
        });

        // 4. Input Area
        const inputArea = container.createDiv({ cls: "ai-terminal-input-area" });
        const inputEl = inputArea.createEl("textarea", {
            cls: "ai-terminal-input",
            attr: { placeholder: "Enter AI instruction..." }
        });

        const sendBtn = new ButtonComponent(inputArea)
            .setIcon("send")
            .setCta()
            .onClick(async () => {
                const text = inputEl.value;
                if (!text.trim()) return;

                // Add User Message
                this.chatHistory.push({ role: 'user', content: text });
                inputEl.value = "";
                this.render();

                await this.processCommand(text);
            });
    }

    async processCommand(input: string) {
        // Collect Context
        let contextText = "";
        for (const file of this.pinnedNotes) {
            const content = await this.app.vault.read(file);
            contextText += `\n=== NOTE: ${file.basename} ===\n${content.substring(0, 10000)}...\n`;
        }

        const systemPrompt = "You are an expert knowledge synthesizer. Output in Markdown.";
        const fullPrompt = `Context:\n${contextText}\n\nInstruction:\n${input}`;

        // Add Loading Placeholder
        this.chatHistory.push({ role: 'system', content: "Generating..." });
        this.render();

        try {
            let response = "";
            const { settings } = this.plugin;

            if (this.currentModel === 'google') {
                response = await AIService.callGoogle(settings.googleApiKey, 'gemini-2.0-flash', systemPrompt, fullPrompt);
            } else if (this.currentModel === 'openai') {
                response = await AIService.callOpenAI(settings.openaiApiKey, 'gpt-4o', systemPrompt, fullPrompt);
            } else if (this.currentModel === 'anthropic') {
                response = await AIService.callAnthropic(settings.anthropicApiKey, 'claude-3-5-sonnet', systemPrompt, fullPrompt);
            }

            // Remove placeholder and add response
            this.chatHistory.pop();
            this.chatHistory.push({ role: 'ai', content: response });
        } catch (e: any) {
            this.chatHistory.pop();
            this.chatHistory.push({ role: 'system', content: `Error: ${e.message}` });
        }
        this.render();
    }
}
