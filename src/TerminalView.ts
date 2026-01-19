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
    uiStyle: 'gemini' | 'chatgpt' | 'claude' = 'gemini'; // UI theme

    // UI Elements
    private headerEl: HTMLElement;
    private contextPanelEl: HTMLElement;
    private chatAreaEl: HTMLElement;
    private inputEl: HTMLTextAreaElement;
    private inputAreaEl: HTMLElement;
    private sendBtn: HTMLButtonElement;

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
        try {
            // Initialize UI Structure Once
            const contentEl = this.contentEl; // Use standard contentEl
            contentEl.empty();
            contentEl.addClass("ai-terminal-container");

            // 1. Header Container
            this.headerEl = contentEl.createDiv({ cls: "ai-terminal-header" });

            // 2. Context Panel Container
            this.contextPanelEl = contentEl.createDiv({ cls: "context-panel-container" });

            // 3. Chat Area Container
            this.chatAreaEl = contentEl.createDiv({ cls: "ai-terminal-chat" });

            // 4. Input Area (Persistent)
            this.inputAreaEl = contentEl.createDiv({ cls: "ai-terminal-input-area" });
            this.initializeInputArea();

            // Initial Render of components
            this.refreshStyle();
            this.refreshHeader();
            this.refreshContext();
            this.refreshChat();

            // Auto-attach currently active note when opening terminal
            this.attachActiveNote();

            // Listen for active leaf changes to auto-attach new notes
            this.registerEvent(
                this.app.workspace.on('active-leaf-change', () => {
                    this.attachActiveNote();
                })
            );
        } catch (e: any) {
            new Notice(`Failed to initialize AI Terminal: ${e.message}`);
            console.error("AI Terminal Init Error:", e);
        }
    }

    initializeInputArea() {
        const inputWrapper = this.inputAreaEl.createDiv({ cls: "input-wrapper" });

        // Attach notes button
        const attachBtn = inputWrapper.createEl("button", {
            cls: "attach-btn",
            attr: { "aria-label": "Attach notes" }
        });
        attachBtn.innerHTML = "📎";
        attachBtn.onclick = () => {
            new MultiNoteSuggester(this.app, this.pinnedNotes, (files) => {
                this.pinnedNotes = files;
                this.refreshContext();
                new Notice(`Attached ${files.length} notes`);
                // Ensure focus returns to input
                setTimeout(() => this.inputEl?.focus(), 100);
            }).open();
        };

        // Text Input
        this.inputEl = inputWrapper.createEl("textarea", {
            cls: "ai-terminal-input",
            attr: {
                placeholder: "Message AI Terminal...",
                rows: "1"
            }
        }) as HTMLTextAreaElement;

        // Send Button
        this.sendBtn = inputWrapper.createEl("button", {
            cls: "send-btn",
            attr: { "aria-label": "Send message" }
        }) as HTMLButtonElement;
        this.sendBtn.innerHTML = "↑";

        // Auto-resize textarea
        const resizeTextarea = () => {
            this.inputEl.style.height = "auto";
            this.inputEl.style.height = Math.min(this.inputEl.scrollHeight, 200) + "px";
        };
        this.inputEl.addEventListener("input", resizeTextarea);

        // Send message function
        const sendMessage = async () => {
            const text = this.inputEl.value.trim();
            if (!text) return;

            // Add User Message
            this.chatHistory.push({ role: 'user', content: text });
            this.inputEl.value = "";
            this.inputEl.style.height = "auto";

            // Explicitly enable input to be safe
            this.inputEl.disabled = false;
            this.sendBtn.disabled = false;
            if (this.inputEl) this.inputEl.focus();

            this.refreshChat();

            await this.processCommand(text);
        };

        // Send on Enter (Shift+Enter for new line)
        this.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        this.sendBtn.addEventListener("click", sendMessage);

        // Initial focus
        setTimeout(() => {
            if (this.inputEl) this.inputEl.focus();
        }, 50);
    }

    refreshStyle() {
        if (!this.contentEl) return;
        // Remove old style classes
        this.contentEl.removeClass("ui-style-gemini", "ui-style-chatgpt", "ui-style-claude");
        // Add new style class
        this.contentEl.addClass(`ui-style-${this.uiStyle}`);
    }

    refreshHeader() {
        if (!this.headerEl) return;
        this.headerEl.empty();

        const headerLeft = this.headerEl.createDiv({ cls: "header-left" });

        // UI Style selector
        const uiStyleSelect = headerLeft.createEl("select", { cls: "ui-style-selector" });
        const uiStyles = [
            { value: 'gemini', text: '✨ Gemini UI' },
            { value: 'chatgpt', text: '🟢 ChatGPT UI' },
            { value: 'claude', text: '✴️ Claude UI' }
        ];
        uiStyles.forEach(style => {
            const el = uiStyleSelect.createEl("option", {
                value: style.value,
                text: style.text
            });
            if (this.uiStyle === style.value) el.selected = true;
        });
        uiStyleSelect.onchange = (e) => {
            this.uiStyle = (e.target as HTMLSelectElement).value as any;
            // Auto-switch model to match UI style
            if (this.uiStyle === 'gemini') this.currentModel = 'google';
            else if (this.uiStyle === 'chatgpt') this.currentModel = 'openai';
            else if (this.uiStyle === 'claude') this.currentModel = 'anthropic';

            this.refreshStyle();
            this.refreshHeader(); // Re-render header to update model select
        };

        const modelSelect = this.headerEl.createEl("select", { cls: "model-selector" });
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
    }

    refreshContext() {
        if (!this.contextPanelEl) return;
        this.contextPanelEl.empty();

        // Force enable inputs
        if (this.inputEl) this.inputEl.disabled = false;
        if (this.sendBtn) this.sendBtn.disabled = false;

        if (this.pinnedNotes.length > 0) {
            this.contextPanelEl.style.display = 'block';
            const contextPanel = this.contextPanelEl.createDiv({ cls: "context-panel" });
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
                        this.refreshContext();
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
                    this.refreshContext();
                };
            });
        } else {
            this.contextPanelEl.style.display = 'none';
        }
    }

    refreshChat() {
        if (!this.chatAreaEl) return;
        this.chatAreaEl.empty();

        // Force enable inputs
        if (this.inputEl) this.inputEl.disabled = false;
        if (this.sendBtn) this.sendBtn.disabled = false;

        const options = [
            { value: 'google', text: 'Gemini 2.0 Flash', icon: '✨' },
            { value: 'openai', text: 'GPT-4o', icon: '🟢' },
            { value: 'anthropic', text: 'Claude 3.5 Sonnet', icon: '✴️' }
        ];

        if (this.chatHistory.length === 0) {
            const emptyState = this.chatAreaEl.createDiv({ cls: "empty-state" });
            emptyState.createEl("div", { text: "👋", cls: "empty-icon" });
            emptyState.createEl("h3", { text: "Start a conversation" });
            emptyState.createEl("p", { text: "Attach notes and ask questions to synthesize insights" });
        } else {
            this.chatHistory.forEach((msg) => {
                const msgWrapper = this.chatAreaEl.createDiv({ cls: `message-wrapper ${msg.role}` });

                if (msg.role === 'user') {
                    const msgBubble = msgWrapper.createDiv({ cls: "message-bubble user-message" });
                    msgBubble.createDiv({ text: msg.content, cls: "message-text" });
                } else if (msg.role === 'ai') {
                    const msgBubble = msgWrapper.createDiv({ cls: "message-bubble ai-message" });

                    const msgHeader = msgBubble.createDiv({ cls: "message-header" });
                    const modelName = options.find(o => o.value === this.currentModel)?.text || 'AI';
                    msgHeader.createDiv({ text: modelName, cls: "message-label" });

                    // Create Note button
                    const createNoteBtn = msgHeader.createEl("button", {
                        cls: "create-note-btn",
                        attr: { "aria-label": "Create note from response" }
                    });
                    createNoteBtn.innerHTML = "📝";
                    createNoteBtn.onclick = async (e) => {
                        e.stopPropagation();
                        await this.createNoteFromResponse(msg.content);
                    };

                    msgBubble.createDiv({ text: msg.content, cls: "message-text" });
                } else if (msg.role === 'system') {
                    const systemMsg = msgWrapper.createDiv({ cls: "system-message" });
                    systemMsg.createDiv({ text: msg.content, cls: "system-text" });
                }
            });

            // Auto-scroll to bottom
            setTimeout(() => {
                this.chatAreaEl.scrollTop = this.chatAreaEl.scrollHeight;
            }, 100);
        }
    }

    attachActiveNote() {
        try {
            const activeFile = this.app.workspace.getActiveFile();
            if (activeFile && activeFile.extension === 'md') {
                if (!this.pinnedNotes.includes(activeFile)) {
                    this.pinnedNotes.push(activeFile);
                    new Notice(`Auto-attached: ${activeFile.basename}`);
                    this.refreshContext();
                }
            }
        } catch (e) {
            console.error("Auto-attach error", e);
        }
    }

    async createNoteFromResponse(content: string) {
        try {
            // Get default folder from settings
            const defaultFolder = this.plugin.settings.defaultFolder || '';

            // Generate note title from first line or timestamp
            const firstLine = content.split('\n')[0].substring(0, 50);
            const timestamp = new Date().toISOString().substring(0, 19).replace(/:/g, '-');
            const noteTitle = firstLine.trim() || `AI Response ${timestamp}`;

            // Sanitize filename
            const sanitizedTitle = noteTitle.replace(/[\\/:*?"<>|]/g, '-');

            // Construct full path
            const folderPath = defaultFolder ? `${defaultFolder}/` : '';
            const fullPath = `${folderPath}${sanitizedTitle}.md`;

            // Check if folder exists, create if needed
            if (defaultFolder) {
                const folderExists = this.app.vault.getAbstractFileByPath(defaultFolder);
                if (!folderExists) {
                    await this.app.vault.createFolder(defaultFolder);
                }
            }

            // Check if file already exists
            let finalPath = fullPath;
            let counter = 1;
            while (this.app.vault.getAbstractFileByPath(finalPath)) {
                const baseName = sanitizedTitle;
                finalPath = `${folderPath}${baseName} ${counter}.md`;
                counter++;
            }

            // Create the note
            const file = await this.app.vault.create(finalPath, content);

            new Notice(`Note created: ${file.basename}`);

            // Optionally open the note
            const leaf = this.app.workspace.getLeaf(false);
            await leaf.openFile(file);

        } catch (e: any) {
            new Notice(`Failed to create note: ${e.message}`);
        }
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
        this.refreshChat();

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
        this.refreshChat();
    }
}
