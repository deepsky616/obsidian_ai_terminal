import { ItemView, WorkspaceLeaf, Notice, TFile, ButtonComponent } from "obsidian";
import AITerminalPlugin from "../main";
import { AIService } from "./AIService";
import { MultiNoteSuggester } from "./NoteSuggester";

export const TERMINAL_VIEW_TYPE = "ai-terminal-view";

const PROVIDER_MODELS = {
    'gemini': [
        { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash' },
        { id: 'gemini-2.5-flash-exp', name: 'Gemini 2.5 Flash' }
    ],
    'openai': [
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
        { id: 'gpt-5-mini', name: 'GPT-5 Mini' }
    ],
    'anthropic': [
        { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku' },
        { id: 'claude-4-5-haiku-latest', name: 'Claude 4.5 Haiku' }
    ]
};

interface ChatMessage {
    role: 'user' | 'ai' | 'system';
    content: string;
}

export class TerminalView extends ItemView {
    plugin: AITerminalPlugin;
    pinnedNotes: TFile[] = [];
    chatHistory: ChatMessage[] = [];

    // UI State
    currentProvider: 'gemini' | 'openai' | 'anthropic' = 'gemini';
    currentModel: string = 'gemini-2.0-flash-exp';

    // UI Elements
    private headerEl: HTMLElement;
    private contextPanelEl: HTMLElement;
    private chatAreaEl: HTMLElement;
    private inputEl: HTMLTextAreaElement;
    private inputAreaEl: HTMLElement;
    private sendBtn: HTMLButtonElement;
    private modelSelectEl: HTMLSelectElement;

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
        return "bot";
    }

    async onOpen() {
        try {
            // Initialize UI Structure Once
            const contentEl = this.contentEl;
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
            this.updateModelSelector();
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

        // 1. Top Bar: Model Selector Pill
        const topBar = inputWrapper.createDiv({ cls: "input-top-bar" });

        this.modelSelectEl = topBar.createEl("select", {
            cls: "model-pill-select"
        });
        // Ensure event listener is attached
        this.modelSelectEl.addEventListener('change', (e) => {
            this.currentModel = (e.target as HTMLSelectElement).value;
            new Notice(`Model set to: ${this.currentModel}`);
        });

        // 2. Main Input Grid
        const mainInput = inputWrapper.createDiv({ cls: "input-main" });

        // Attach notes button
        const attachBtn = mainInput.createEl("button", {
            cls: "attach-btn",
            attr: { "aria-label": "Attach notes" }
        });
        attachBtn.innerHTML = "📎";
        attachBtn.addEventListener('click', () => {
            new MultiNoteSuggester(this.app, this.pinnedNotes, (files) => {
                this.pinnedNotes = files;
                this.refreshContext();
                new Notice(`Attached ${files.length} notes`);
                setTimeout(() => this.inputEl?.focus(), 100);
            }).open();
        });

        // Text Input
        this.inputEl = mainInput.createEl("textarea", {
            cls: "ai-terminal-input",
            attr: {
                placeholder: "Ask anything...",
                rows: "1"
            }
        }) as HTMLTextAreaElement;

        // Send Button
        this.sendBtn = mainInput.createEl("button", {
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

    updateModelSelector() {
        if (!this.modelSelectEl) return;
        this.modelSelectEl.empty();

        const models = PROVIDER_MODELS[this.currentProvider];
        models.forEach(m => {
            const opt = this.modelSelectEl.createEl("option", {
                value: m.id,
                text: m.name
            });
            if (this.currentModel === m.id) opt.selected = true;
        });
    }

    refreshStyle() {
        if (!this.contentEl) return;
        this.contentEl.removeClass("ui-style-gemini", "ui-style-chatgpt", "ui-style-claude");

        // Map provider to style class
        const styleMap = {
            'gemini': 'gemini',
            'openai': 'chatgpt',
            'anthropic': 'claude'
        };
        this.contentEl.addClass(`ui-style-${styleMap[this.currentProvider]}`);
    }

    refreshHeader() {
        if (!this.headerEl) return;
        this.headerEl.empty();

        const tabsContainer = this.headerEl.createDiv({ cls: "provider-tabs" });

        const providers = [
            { id: 'gemini', label: 'Gemini' },
            { id: 'openai', label: 'ChatGPT' },
            { id: 'anthropic', label: 'Claude' }
        ];

        providers.forEach(p => {
            const tab = tabsContainer.createEl("button", {
                cls: `provider-tab ${this.currentProvider === p.id ? 'active' : ''}`,
                text: p.label,
                attr: { "data-provider": p.id }
            });
            // Use standard event listener
            tab.addEventListener('click', () => {
                this.currentProvider = p.id as any;
                // Set default model for new provider
                this.currentModel = PROVIDER_MODELS[this.currentProvider][0].id;

                this.refreshStyle();
                this.refreshHeader();
                this.updateModelSelector();
            });
        });
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
            // Edit button removed as per user request

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

                // FIX: Use addEventListener with stopPropagation and preventDefault
                removeBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    // Filter logic
                    const newPinned = this.pinnedNotes.filter(f => f.path !== file.path);
                    if (newPinned.length !== this.pinnedNotes.length) {
                        this.pinnedNotes = newPinned;
                        this.refreshContext();
                    }
                });
            });
        } else {
            this.contextPanelEl.style.display = 'none';
        }
    }

    refreshChat() {
        if (!this.chatAreaEl) return;
        this.chatAreaEl.empty();

        if (this.inputEl) this.inputEl.disabled = false;
        if (this.sendBtn) this.sendBtn.disabled = false;

        if (this.chatHistory.length === 0) {
            const emptyState = this.chatAreaEl.createDiv({ cls: "empty-state" });
            emptyState.createEl("div", { text: "👋", cls: "empty-icon" });
            emptyState.createEl("h3", { text: "Hello, Friend" });
            emptyState.createEl("p", { text: "I'm ready to help you with your notes." });
        } else {
            this.chatHistory.forEach((msg) => {
                const msgWrapper = this.chatAreaEl.createDiv({ cls: `message-wrapper ${msg.role}` });

                if (msg.role === 'user') {
                    const msgBubble = msgWrapper.createDiv({ cls: "message-bubble user-message" });
                    msgBubble.createDiv({ text: msg.content, cls: "message-text" });
                } else if (msg.role === 'ai') {
                    const msgBubble = msgWrapper.createDiv({ cls: "message-bubble ai-message" });

                    const msgHeader = msgBubble.createDiv({ cls: "message-header" });
                    msgHeader.createDiv({ text: "AI", cls: "message-label" });

                    const createNoteBtn = msgHeader.createEl("button", {
                        cls: "create-note-btn",
                        attr: { "aria-label": "Create note" }
                    });
                    createNoteBtn.innerHTML = "📝";

                    createNoteBtn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        await this.createNoteFromResponse(msg.content);
                    });

                    msgBubble.createDiv({ text: msg.content, cls: "message-text" });
                } else if (msg.role === 'system') {
                    const systemMsg = msgWrapper.createDiv({ cls: "system-message" });
                    systemMsg.createDiv({ text: msg.content, cls: "system-text" });
                }
            });

            setTimeout(() => {
                this.chatAreaEl.scrollTop = this.chatAreaEl.scrollHeight;
            }, 100);
        }
    }

    attachActiveNote() {
        try {
            const activeFile = this.app.workspace.getActiveFile();
            if (activeFile && activeFile.extension === 'md') {
                if (!this.pinnedNotes.some(f => f.path === activeFile.path)) {
                    this.pinnedNotes.push(activeFile);
                    new Notice(`Attached: ${activeFile.basename}`);
                    this.refreshContext();
                }
            }
        } catch (e) {
            console.error("Auto-attach error", e);
        }
    }

    async createNoteFromResponse(content: string) {
        try {
            const defaultFolder = this.plugin.settings.defaultFolder || '';
            const firstLine = content.split('\n')[0].substring(0, 50);
            const timestamp = new Date().toISOString(); // ISO format for 'created'
            const noteTitle = firstLine.replace(/["\\/]/g, '').trim() || `AI Response ${timestamp}`; // Clean title
            const sanitizedTitle = noteTitle.replace(/[\\/:*?"<>|]/g, '-');
            const folderPath = defaultFolder ? `${defaultFolder}/` : '';
            const fullPath = `${folderPath}${sanitizedTitle}.md`;

            if (defaultFolder) {
                const folderExists = this.app.vault.getAbstractFileByPath(defaultFolder);
                if (!folderExists) {
                    await this.app.vault.createFolder(defaultFolder);
                }
            }

            let finalPath = fullPath;
            let counter = 1;
            while (this.app.vault.getAbstractFileByPath(finalPath)) {
                const baseName = sanitizedTitle;
                finalPath = `${folderPath}${baseName} ${counter}.md`;
                counter++;
            }

            // Construct File Content with Obsidian Properties
            const fileContent = `---
title: "${noteTitle}"
tags: []
aliases: []
created: ${timestamp}
type: 
priority: 
source: "AI Terminal"
related: []
keywords: []
summary: 
---

${content}`;

            const file = await this.app.vault.create(finalPath, fileContent);
            new Notice(`Note created: ${file.basename}`);
            const leaf = this.app.workspace.getLeaf(false);
            await leaf.openFile(file);

        } catch (e: any) {
            new Notice(`Failed to create note: ${e.message}`);
        }
    }

    async processCommand(input: string) {
        let contextText = "";
        for (const file of this.pinnedNotes) {
            const content = await this.app.vault.read(file);
            contextText += `\n=== NOTE: ${file.basename} ===\n${content.substring(0, 10000)}...\n`;
        }

        const systemPrompt = "You are an expert knowledge synthesizer. Output in Markdown.";
        const fullPrompt = `Context:\n${contextText}\n\nInstruction:\n${input}`;

        this.chatHistory.push({ role: 'system', content: "Generating..." });
        this.refreshChat();

        try {
            let response = "";
            const { settings } = this.plugin;

            if (this.currentProvider === 'gemini') {
                response = await AIService.callGoogle(settings.googleApiKey, this.currentModel, systemPrompt, fullPrompt);
            } else if (this.currentProvider === 'openai') {
                response = await AIService.callOpenAI(settings.openaiApiKey, this.currentModel, systemPrompt, fullPrompt);
            } else if (this.currentProvider === 'anthropic') {
                response = await AIService.callAnthropic(settings.anthropicApiKey, this.currentModel, systemPrompt, fullPrompt);
            }

            this.chatHistory.pop();
            this.chatHistory.push({ role: 'ai', content: response });
        } catch (e: any) {
            this.chatHistory.pop();
            this.chatHistory.push({ role: 'system', content: `Error: ${e.message}` });
        }
        this.refreshChat();
    }
}
