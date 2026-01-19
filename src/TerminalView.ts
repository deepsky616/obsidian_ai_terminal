import { ItemView, WorkspaceLeaf, Notice, TFile, ButtonComponent } from "obsidian";
import AITerminalPlugin from "../main";
import { AIService } from "./AIService";
import { MultiNoteSuggester } from "./NoteSuggester";

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

        // 1. Modern Header with Model Selector
        const header = container.createDiv({ cls: "ai-terminal-header" });

        const headerLeft = header.createDiv({ cls: "header-left" });
        headerLeft.createEl("span", { text: "AI Terminal", cls: "ai-terminal-title" });

        const modelSelect = header.createEl("select", { cls: "model-selector" });
        const options = [
            { value: 'google', text: 'Gemini 2.0 Flash', icon: '✨' },
            { value: 'openai', text: 'GPT-4o', icon: '🟢' },
            { value: 'anthropic', text: 'Claude 3.5 Sonnet', icon: '✴️' }
        ];
        options.forEach(opt => {
            const el = modelSelect.createEl("option", {
                value: opt.value,
                text: `${opt.icon} ${opt.text}`
            });
            if (this.currentModel === opt.value) el.selected = true;
        });
        modelSelect.onchange = (e) => {
            this.currentModel = (e.target as HTMLSelectElement).value as any;
            new Notice(`Switched to ${options.find(o => o.value === this.currentModel)?.text}`);
        };

        // 2. Context Panel (Collapsible)
        if (this.pinnedNotes.length > 0) {
            const contextPanel = container.createDiv({ cls: "context-panel" });
            const contextHeader = contextPanel.createDiv({ cls: "context-panel-header" });

            const contextTitle = contextHeader.createDiv({ cls: "context-title" });
            contextTitle.createEl("span", { text: "📎", cls: "context-icon" });
            contextTitle.createEl("span", { text: `${this.pinnedNotes.length} notes attached` });

            const contextActions = contextHeader.createDiv({ cls: "context-actions" });

            new ButtonComponent(contextActions)
                .setButtonText("Edit")
                .setClass("context-edit-btn")
                .onClick(() => {
                    new MultiNoteSuggester(this.app, this.pinnedNotes, (files) => {
                        this.pinnedNotes = files;
                        this.render();
                        new Notice(`Updated pinned notes: ${files.length} selected`);
                    }).open();
                });

            const contextList = contextPanel.createDiv({ cls: "context-list" });
            this.pinnedNotes.forEach(file => {
                const item = contextList.createDiv({ cls: "context-item" });

                const fileInfo = item.createDiv({ cls: "context-file-info" });
                fileInfo.createEl("span", { text: "📄", cls: "file-icon" });
                fileInfo.createEl("span", { text: file.basename, cls: "file-name" });

                const removeBtn = item.createEl("button", {
                    cls: "context-remove-btn",
                    attr: { "aria-label": "Remove note" }
                });
                removeBtn.innerHTML = "×";
                removeBtn.onclick = () => {
                    this.pinnedNotes = this.pinnedNotes.filter(f => f !== file);
                    this.render();
                };
            });
        }

        // 3. Chat Area (Modern bubbles)
        const chatArea = container.createDiv({ cls: "ai-terminal-chat" });

        if (this.chatHistory.length === 0) {
            const emptyState = chatArea.createDiv({ cls: "empty-state" });
            emptyState.createEl("div", { text: "👋", cls: "empty-icon" });
            emptyState.createEl("h3", { text: "Start a conversation" });
            emptyState.createEl("p", { text: "Attach notes and ask questions to synthesize insights" });
        } else {
            this.chatHistory.forEach((msg) => {
                const msgWrapper = chatArea.createDiv({ cls: `message-wrapper ${msg.role}` });

                if (msg.role === 'user') {
                    const msgBubble = msgWrapper.createDiv({ cls: "message-bubble user-message" });
                    msgBubble.createDiv({ text: msg.content, cls: "message-text" });
                } else if (msg.role === 'ai') {
                    const msgBubble = msgWrapper.createDiv({ cls: "message-bubble ai-message" });
                    const modelName = options.find(o => o.value === this.currentModel)?.text || 'AI';
                    msgBubble.createDiv({ text: modelName, cls: "message-label" });
                    msgBubble.createDiv({ text: msg.content, cls: "message-text" });
                } else if (msg.role === 'system') {
                    const systemMsg = msgWrapper.createDiv({ cls: "system-message" });
                    systemMsg.createDiv({ text: msg.content, cls: "system-text" });
                }
            });

            // Auto-scroll to bottom
            setTimeout(() => {
                chatArea.scrollTop = chatArea.scrollHeight;
            }, 100);
        }

        // 4. Input Area (Modern ChatGPT-style)
        const inputArea = container.createDiv({ cls: "ai-terminal-input-area" });

        const inputWrapper = inputArea.createDiv({ cls: "input-wrapper" });

        // Attach notes button
        const attachBtn = inputWrapper.createEl("button", {
            cls: "attach-btn",
            attr: { "aria-label": "Attach notes" }
        });
        attachBtn.innerHTML = "📎";
        attachBtn.onclick = () => {
            new MultiNoteSuggester(this.app, this.pinnedNotes, (files) => {
                this.pinnedNotes = files;
                this.render();
                new Notice(`Attached ${files.length} notes`);
            }).open();
        };

        const inputEl = inputWrapper.createEl("textarea", {
            cls: "ai-terminal-input",
            attr: {
                placeholder: "Message AI Terminal...",
                rows: "1"
            }
        }) as HTMLTextAreaElement;

        const sendBtn = inputWrapper.createEl("button", {
            cls: "send-btn",
            attr: { "aria-label": "Send message" }
        }) as HTMLButtonElement;
        sendBtn.innerHTML = "↑";

        // Auto-resize textarea
        const resizeTextarea = () => {
            inputEl.style.height = "auto";
            inputEl.style.height = Math.min(inputEl.scrollHeight, 200) + "px";
        };

        inputEl.addEventListener("input", resizeTextarea);

        // Send message function
        const sendMessage = async () => {
            const text = inputEl.value.trim();
            if (!text) return;

            // Add User Message
            this.chatHistory.push({ role: 'user', content: text });
            inputEl.value = "";
            inputEl.style.height = "auto";
            this.render();

            await this.processCommand(text);
        };

        // Send on Enter (Shift+Enter for new line)
        inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        sendBtn.addEventListener("click", sendMessage);

        // Focus input on render (only if chat is empty or after sending)
        setTimeout(() => {
            inputEl.focus();
        }, 50);
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
