import { ItemView, WorkspaceLeaf, Notice, TFile, TFolder, ButtonComponent, Menu } from "obsidian";
import AITerminalPlugin, { CustomCommand, PROVIDER_MODELS } from "../main";
import { AIService } from "./AIService";
import { NoteSuggester, MultiNoteSuggester, FolderSuggester } from "./NoteSuggester";

export const TERMINAL_VIEW_TYPE = "ai-terminal-view";

interface ChatMessage {
    role: 'user' | 'ai' | 'system';
    content: string;
}

interface AttachmentItem {
    type: 'file' | 'folder';
    name: string; // Basename for file, Folder name for folder
    path: string; // Full path
    items: TFile[]; // The actual files
    count: number;
}

export class TerminalView extends ItemView {
    plugin: AITerminalPlugin;
    attachments: AttachmentItem[] = [];
    chatHistory: ChatMessage[] = [];

    get pinnedNotes(): TFile[] {
        const unique = new Map<string, TFile>();
        this.attachments.forEach(att => {
            att.items.forEach(f => unique.set(f.path, f));
        });
        return Array.from(unique.values());
    }

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


            // Auto-attach currently active note only when user interacts (clicks) on the chat area
            // This excludes buttons, inputs, and header interactions
            this.chatAreaEl.addEventListener('click', () => {
                this.attachActiveNote();
            });

            // Remove global listener to prevent spamming context
            // this.registerEvent(
            //     this.app.workspace.on('active-leaf-change', () => {
            //         this.attachActiveNote();
            //     })
            // );
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

        // Attach notes button (Unified Menu)
        const attachBtn = mainInput.createEl("button", {
            cls: "attach-btn",
            attr: { "aria-label": "Attach..." }
        });
        attachBtn.innerHTML = "📎";

        attachBtn.addEventListener('click', (e) => {
            const menu = new Menu();

            menu.addItem((item) => {
                item.setTitle("Attach Notes")
                    .setIcon("file-text")
                    .onClick(() => {
                        const currentFiles = this.attachments.filter(a => a.type === 'file').flatMap(a => a.items);

                        new MultiNoteSuggester(this.app, currentFiles, (files) => {
                            this.attachments = this.attachments.filter(a => a.type !== 'file');

                            files.forEach(f => {
                                this.attachments.push({
                                    type: 'file',
                                    name: f.basename,
                                    path: f.path,
                                    items: [f],
                                    count: 1
                                });
                            });

                            this.refreshContext();
                            new Notice(`Attached ${files.length} notes`);
                            setTimeout(() => this.inputEl?.focus(), 100);
                        }).open();
                    });
            });

            menu.addItem((item) => {
                item.setTitle("Attach Folder")
                    .setIcon("folder")
                    .onClick(() => {
                        new FolderSuggester(this.app, (folder) => {
                            let filesToAdd: TFile[] = [];

                            const collectFiles = (folder: TFolder) => {
                                folder.children.forEach(child => {
                                    if (child instanceof TFile && child.extension === 'md') {
                                        filesToAdd.push(child);
                                    } else if (child instanceof TFolder) {
                                        collectFiles(child);
                                    }
                                });
                            };

                            collectFiles(folder);

                            if (filesToAdd.length > 0) {
                                // Add as single attachment item
                                this.attachments.push({
                                    type: 'folder',
                                    name: folder.name,
                                    path: folder.path,
                                    items: filesToAdd,
                                    count: filesToAdd.length
                                });
                                this.refreshContext();
                                new Notice(`Attached folder "${folder.name}" (${filesToAdd.length} notes)`);
                            } else {
                                new Notice(`No markdown notes found in "${folder.name}"`);
                            }
                            setTimeout(() => this.inputEl?.focus(), 100);
                        }).open();
                    });
            });

            menu.showAtMouseEvent(e);
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
            if (e.isComposing) return;
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

    getProviderModels(): {id: string, name: string}[] {
        return PROVIDER_MODELS[this.currentProvider];
    }

    updateModelSelector() {
        if (!this.modelSelectEl) return;
        this.modelSelectEl.empty();

        const models = this.getProviderModels();
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
                this.currentProvider = p.id as 'gemini' | 'openai' | 'anthropic';
                const models = this.getProviderModels();
                this.currentModel = models.length > 0 ? models[0].id : '';

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

        if (this.attachments.length > 0) {
            this.contextPanelEl.style.display = 'block';
            const contextPanel = this.contextPanelEl.createDiv({ cls: "context-panel" });
            const contextHeader = contextPanel.createDiv({ cls: "context-panel-header" });

            const contextTitle = contextHeader.createDiv({ cls: "context-title" });
            const totalNotes = this.pinnedNotes.length; // Use getter
            contextTitle.createEl("span", { text: "📎", cls: "context-icon" });
            contextTitle.createEl("span", { text: `${totalNotes} notes attached` });

            const contextActions = contextHeader.createDiv({ cls: "context-actions" });

            const contextList = contextPanel.createDiv({ cls: "context-list" });

            this.attachments.forEach((att, index) => {
                const item = contextList.createDiv({ cls: "context-item" });

                const fileInfo = item.createDiv({ cls: "context-file-info" });

                if (att.type === 'folder') {
                    fileInfo.createEl("span", { text: "📂", cls: "file-icon" });
                    fileInfo.createEl("span", {
                        text: `${att.name} (${att.count} notes)`,
                        cls: "file-name folder-group"
                    });
                    item.title = att.items.map(f => f.basename).join(", ");
                } else {
                    fileInfo.createEl("span", { text: "📄", cls: "file-icon" });
                    fileInfo.createEl("span", { text: att.name, cls: "file-name" });
                }

                const removeBtn = item.createEl("button", {
                    cls: "context-remove-btn",
                    attr: { "aria-label": "Remove" }
                });
                removeBtn.innerHTML = "×";

                removeBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    this.attachments.splice(index, 1);
                    this.refreshContext();
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
                // Check if already in 'file' attachments
                // Also check if covered by folder? (optional)
                // Let's just avoid duplicate 'file' attachment items for the same path.
                const exists = this.attachments.some(a => a.type === 'file' && a.path === activeFile.path);

                if (!exists) {
                    this.attachments.push({
                        type: 'file',
                        name: activeFile.basename,
                        path: activeFile.path,
                        items: [activeFile],
                        count: 1
                    });
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
            const now = new Date();
            const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
            const timeStr = now.toISOString().slice(0, 16).replace('T', ' ');
            
            let noteTitle = '';
            let finalContent = content;
            
            // Check if content has YAML frontmatter with title
            const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
            if (yamlMatch) {
                const yamlContent = yamlMatch[1];
                const titleMatch = yamlContent.match(/title:\s*"?([^"\n]+)"?/);
                if (titleMatch) {
                    noteTitle = titleMatch[1].trim();
                }
                finalContent = content;
            } else {
                // No YAML frontmatter - extract from first heading or first line
                const headingMatch = content.match(/^#\s+(.+)$/m);
                if (headingMatch) {
                    noteTitle = headingMatch[1].trim();
                } else {
                    const firstLine = content.split('\n')[0].substring(0, 50);
                    noteTitle = firstLine.replace(/[#"\\/]/g, '').trim();
                }
                
                // Add YAML frontmatter if not present
                finalContent = `---
title: "${noteTitle} ${dateStr}"
tags: []
aliases: []
created: "${timeStr}"
type: ["Note"]
status: "작성완료"
priority: "Medium"
source: "AI Terminal"
related: []
keywords: []
summary: ""
---

${content}`;
                noteTitle = `${noteTitle} ${dateStr}`;
            }
            
            // Add date suffix if not already present
            if (!noteTitle.match(/\d{8}$/)) {
                noteTitle = `${noteTitle} ${dateStr}`;
            }
            
            noteTitle = noteTitle || `AI Response ${dateStr}`;
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

            const file = await this.app.vault.create(finalPath, finalContent);
            new Notice(`Note created: ${file.basename}`);
            const leaf = this.app.workspace.getLeaf(false);
            await leaf.openFile(file);

        } catch (e: any) {
            new Notice(`Failed to create note: ${e.message}`);
        }
    }

    findCommandBySlash(input: string): CustomCommand | undefined {
        const commands = this.plugin.settings.customCommands;
        for (const cmd of commands) {
            if (input.startsWith(cmd.command + ' ') || input === cmd.command) {
                return cmd;
            }
        }
        return undefined;
    }

    async processCommand(input: string) {
        let contextText = "";
        for (const file of this.pinnedNotes) {
            const content = await this.app.vault.read(file);
            contextText += `\n=== NOTE: ${file.basename} ===\n${content.substring(0, 10000)}...\n`;
        }

        const customCommand = this.findCommandBySlash(input);
        
        let provider = this.currentProvider;
        let modelId = this.currentModel;
        let systemPrompt = "You are an expert knowledge synthesizer. Output in Markdown.";
        let userMessage = input;

        if (customCommand) {
            provider = customCommand.provider;
            modelId = customCommand.modelId;
            systemPrompt = customCommand.promptTemplate;
            userMessage = input.slice(customCommand.command.length).trim() || input;
            new Notice(`Using: ${customCommand.name}`);
        }

        const fullPrompt = `Context:\n${contextText}\n\nInstruction:\n${userMessage}`;

        this.chatHistory.push({ role: 'system', content: "Generating..." });
        this.refreshChat();

        try {
            let response = "";
            const { settings } = this.plugin;

            if (provider === 'gemini') {
                response = await AIService.callGoogle(settings.googleApiKey, modelId, systemPrompt, fullPrompt);
            } else if (provider === 'openai') {
                response = await AIService.callOpenAI(settings.openaiApiKey, modelId, systemPrompt, fullPrompt);
            } else if (provider === 'anthropic') {
                response = await AIService.callAnthropic(settings.anthropicApiKey, modelId, systemPrompt, fullPrompt);
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
