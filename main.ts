import { App, Plugin, PluginSettingTab, Setting, WorkspaceLeaf, TextAreaComponent } from 'obsidian';
import { TerminalView, TERMINAL_VIEW_TYPE } from './src/TerminalView';

export interface CustomCommand {
    id: string;
    provider: 'gemini' | 'openai' | 'anthropic';
    modelId: string;
    name: string;
    command: string;
    promptTemplate: string;
}

export interface PluginSettings {
    googleApiKey: string;
    openaiApiKey: string;
    anthropicApiKey: string;
    defaultFolder: string;
    customCommands: CustomCommand[];
}

const PROMPT_TEMPLATES = {
    basic: 'You are an expert knowledge synthesizer. Output in Markdown.',
    obsidianNote: `You are an Obsidian note creation expert. Create notes with YAML frontmatter (properties).

IMPORTANT: 
- The note title MUST end with the date in YYYYMMDD format (e.g., "My Note Title 20260124")
- Use today's date for the created field and title suffix
- The H1 heading must match the title property exactly

Output format:
---
title: "[Descriptive Title] YYYYMMDD"
tags:
  - tag1
  - tag2
aliases:
  - alias1
  - alias2
created: YYYY-MM-DD HH:mm
type: Blog
status: pending
priority: Medium
source: 
related:
  - "[[Related Note]]"
keywords:
  - keyword1
  - keyword2
summary: Brief one-line summary of the content
---

# [Descriptive Title] YYYYMMDD

## Content
Write well-structured content here with proper markdown formatting.`,
    
    summarize: `You are an expert content summarizer for Obsidian notes.

IMPORTANT:
- The note title MUST end with the date in YYYYMMDD format
- Use today's date for created field and title suffix

Output format:
---
title: "Summary [Topic] YYYYMMDD"
tags:
  - summary
created: YYYY-MM-DD HH:mm
type: Summary
status: complete
summary: One-line summary of the key takeaways
---

# Summary [Topic] YYYYMMDD

## Key Points
- Main point 1
- Main point 2
- Main point 3

## Summary
Concise summary paragraph explaining the main content.

## Related Topics
- [[Related Note 1]]
- [[Related Note 2]]`,

    analyze: `You are an expert analyst. Analyze the given content and create an Obsidian note.

IMPORTANT:
- The note title MUST end with the date in YYYYMMDD format
- Use today's date for created field and title suffix

Output format:
---
title: "Analysis [Topic] YYYYMMDD"
tags:
  - analysis
created: YYYY-MM-DD HH:mm
type: Analysis
status: complete
priority: Medium
summary: One-line summary of the analysis findings
---

# Analysis [Topic] YYYYMMDD

## Overview
Brief overview of what was analyzed.

## Key Findings
1. Finding 1
2. Finding 2
3. Finding 3

## Implications
What this means and why it matters.

## Action Items
- [ ] Action 1
- [ ] Action 2`
};

export const PROVIDER_MODELS = {
    gemini: [
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
        { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite' },
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
        { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite' },
    ],
    openai: [
        { id: 'gpt-4.1', name: 'GPT-4.1' },
        { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini' },
        { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano' },
        { id: 'gpt-4o', name: 'GPT-4o' },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
        { id: 'o3', name: 'o3' },
        { id: 'o3-mini', name: 'o3 Mini' },
        { id: 'o4-mini', name: 'o4 Mini' },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
        { id: 'gpt-4', name: 'GPT-4' },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
    ],
    anthropic: [
        { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5' },
        { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5' },
        { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5' },
        { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
        { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet' },
        { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
    ]
};

const DEFAULT_CUSTOM_COMMANDS: CustomCommand[] = [
    { id: '1', provider: 'gemini', modelId: 'gemini-2.5-flash', name: 'Gemini Flash', command: '/gemini', promptTemplate: PROMPT_TEMPLATES.basic },
    { id: '2', provider: 'openai', modelId: 'gpt-4o-mini', name: 'GPT-4o Mini', command: '/gpt', promptTemplate: PROMPT_TEMPLATES.basic },
    { id: '3', provider: 'anthropic', modelId: 'claude-haiku-4-5-20251001', name: 'Claude Haiku', command: '/claude', promptTemplate: PROMPT_TEMPLATES.basic },
];

const DEFAULT_SETTINGS: PluginSettings = {
    googleApiKey: '',
    openaiApiKey: '',
    anthropicApiKey: '',
    defaultFolder: '',
    customCommands: DEFAULT_CUSTOM_COMMANDS
}

export default class AITerminalPlugin extends Plugin {
    settings: PluginSettings;

    async onload() {
        await this.loadSettings();

        // Register View
        this.registerView(
            TERMINAL_VIEW_TYPE,
            (leaf) => new TerminalView(leaf, this)
        );

        // Ribbon Icon
        this.addRibbonIcon('bot', 'Open AI Terminal', () => {
            this.activateView();
        });

        this.addCommand({
            id: 'open-ai-terminal',
            name: 'Open AI Terminal',
            callback: () => {
                this.activateView();
            }
        });

        // Command to open terminal with current note attached
        this.addCommand({
            id: 'open-ai-terminal-with-note',
            name: 'Open AI Terminal with current note',
            checkCallback: (checking: boolean) => {
                const activeFile = this.app.workspace.getActiveFile();
                if (activeFile && activeFile.extension === 'md') {
                    if (!checking) {
                        this.activateView();
                    }
                    return true;
                }
                return false;
            }
        });

        this.addSettingTab(new AITerminalSettingTab(this.app, this));
    }

    async activateView() {
        const { workspace } = this.app;
        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(TERMINAL_VIEW_TYPE);

        if (leaves.length > 0) {
            leaf = leaves[0];
        } else {
            leaf = workspace.getRightLeaf(false);
            await leaf.setViewState({ type: TERMINAL_VIEW_TYPE, active: true });
        }
        workspace.revealLeaf(leaf);
    }

    onunload() {
        // Cleanup
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

class AITerminalSettingTab extends PluginSettingTab {
    plugin: AITerminalPlugin;

    constructor(app: App, plugin: AITerminalPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'AI Terminal Settings' });

        // API Keys Section
        containerEl.createEl('h3', { text: 'API Keys' });

        new Setting(containerEl)
            .setName('Google Gemini API Key')
            .setDesc('Enter your Google Gemini API Key')
            .addText(text => text
                .setPlaceholder('AIzaSy...')
                .setValue(this.plugin.settings.googleApiKey)
                .onChange(async (value) => {
                    this.plugin.settings.googleApiKey = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('OpenAI API Key')
            .setDesc('Enter your OpenAI API Key')
            .addText(text => text
                .setPlaceholder('sk-...')
                .setValue(this.plugin.settings.openaiApiKey)
                .onChange(async (value) => {
                    this.plugin.settings.openaiApiKey = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Anthropic API Key')
            .setDesc('Enter your Anthropic API Key')
            .addText(text => text
                .setPlaceholder('sk-ant-...')
                .setValue(this.plugin.settings.anthropicApiKey)
                .onChange(async (value) => {
                    this.plugin.settings.anthropicApiKey = value;
                    await this.plugin.saveSettings();
                }));

        // Note Creation Section
        containerEl.createEl('h3', { text: 'Note Creation' });

        new Setting(containerEl)
            .setName('Default Folder')
            .setDesc('Default folder for creating new notes from AI responses. Leave empty for vault root.')
            .addText(text => text
                .setPlaceholder('AI Notes')
                .setValue(this.plugin.settings.defaultFolder)
                .onChange(async (value) => {
                    this.plugin.settings.defaultFolder = value;
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('h3', { text: 'Custom Commands' });
        containerEl.createEl('p', { 
            text: 'Create custom slash commands with any model and prompt template.',
            cls: 'setting-item-description'
        });

        const commandListContainer = containerEl.createDiv({ cls: 'command-list-container' });
        const commands = this.plugin.settings.customCommands;
        
        commands.forEach((cmd, index) => {
            const commandItem = commandListContainer.createDiv({ cls: 'command-list-item' });
            
            const commandHeader = commandItem.createDiv({ cls: 'command-list-header' });
            const commandInfo = commandHeader.createDiv({ cls: 'command-list-info' });
            commandInfo.createEl('span', { text: cmd.command, cls: 'command-slash' });
            commandInfo.createEl('span', { text: cmd.name, cls: 'command-name' });
            
            const headerActions = commandHeader.createDiv({ cls: 'command-header-actions' });
            const deleteBtn = headerActions.createEl('button', { 
                cls: 'command-delete-btn',
                attr: { 'aria-label': 'Delete command' }
            });
            deleteBtn.innerHTML = '×';
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                this.plugin.settings.customCommands.splice(index, 1);
                await this.plugin.saveSettings();
                this.display();
            });
            
            const chevron = headerActions.createEl('span', { cls: 'command-chevron', text: '›' });
            
            const commandDetails = commandItem.createDiv({ cls: 'command-details hidden' });
            
            commandHeader.addEventListener('click', (e) => {
                if ((e.target as HTMLElement).closest('.command-delete-btn')) return;
                
                const isHidden = commandDetails.hasClass('hidden');
                commandListContainer.querySelectorAll('.command-details').forEach(el => el.addClass('hidden'));
                commandListContainer.querySelectorAll('.command-chevron').forEach(el => el.removeClass('expanded'));
                
                if (isHidden) {
                    commandDetails.removeClass('hidden');
                    chevron.addClass('expanded');
                }
            });

            new Setting(commandDetails)
                .setName('Name')
                .setDesc('Display name shown in the command list')
                .addText(text => text
                    .setPlaceholder('e.g., Note Summarizer')
                    .setValue(cmd.name)
                    .onChange(async (value) => {
                        this.plugin.settings.customCommands[index].name = value;
                        await this.plugin.saveSettings();
                        commandInfo.querySelector('.command-name')!.textContent = value;
                    }));

            new Setting(commandDetails)
                .setName('Command')
                .setDesc('Slash command to trigger (type this in chat to activate)')
                .addText(text => text
                    .setPlaceholder('e.g., /summarize')
                    .setValue(cmd.command)
                    .onChange(async (value) => {
                        this.plugin.settings.customCommands[index].command = value;
                        await this.plugin.saveSettings();
                        commandInfo.querySelector('.command-slash')!.textContent = value;
                    }));

            let modelDropdownEl: HTMLSelectElement;

            new Setting(commandDetails)
                .setName('Provider')
                .setDesc('AI provider to use for this command')
                .addDropdown(dropdown => dropdown
                    .addOption('gemini', 'Google Gemini')
                    .addOption('openai', 'OpenAI')
                    .addOption('anthropic', 'Anthropic')
                    .setValue(cmd.provider)
                    .onChange(async (value: 'gemini' | 'openai' | 'anthropic') => {
                        this.plugin.settings.customCommands[index].provider = value;
                        const models = PROVIDER_MODELS[value];
                        this.plugin.settings.customCommands[index].modelId = models[0].id;
                        
                        modelDropdownEl.empty();
                        models.forEach(model => {
                            const opt = modelDropdownEl.createEl('option', { value: model.id, text: model.name });
                            if (model.id === models[0].id) opt.selected = true;
                        });
                        
                        await this.plugin.saveSettings();
                    }));

            new Setting(commandDetails)
                .setName('Model')
                .setDesc('Select the AI model to use')
                .addDropdown(dropdown => {
                    modelDropdownEl = dropdown.selectEl;
                    const models = PROVIDER_MODELS[cmd.provider];
                    models.forEach(model => {
                        dropdown.addOption(model.id, model.name);
                    });
                    dropdown.setValue(cmd.modelId);
                    dropdown.onChange(async (value) => {
                        this.plugin.settings.customCommands[index].modelId = value;
                        await this.plugin.saveSettings();
                    });
                });

            commandDetails.createEl('div', { cls: 'prompt-section-header', text: 'Prompt Template' });
            commandDetails.createEl('p', { 
                cls: 'prompt-section-desc',
                text: 'System prompt that defines AI behavior. Use templates below for Obsidian-optimized outputs.'
            });

            const templateBtnContainer = commandDetails.createDiv({ cls: 'template-btn-container' });
            
            const textAreaContainer = commandDetails.createDiv({ cls: 'prompt-template-container' });
            const textArea = new TextAreaComponent(textAreaContainer);
            textArea.setValue(cmd.promptTemplate);
            textArea.inputEl.rows = 8;
            textArea.inputEl.style.width = '100%';
            textArea.onChange(async (value) => {
                this.plugin.settings.customCommands[index].promptTemplate = value;
                await this.plugin.saveSettings();
            });

            const createTemplateBtn = (label: string, template: string) => {
                const btn = templateBtnContainer.createEl('button', { 
                    cls: 'template-btn',
                    text: label 
                });
                btn.addEventListener('click', async () => {
                    textArea.setValue(template);
                    this.plugin.settings.customCommands[index].promptTemplate = template;
                    await this.plugin.saveSettings();
                });
            };

            createTemplateBtn('Basic', PROMPT_TEMPLATES.basic);
            createTemplateBtn('Obsidian Note', PROMPT_TEMPLATES.obsidianNote);
            createTemplateBtn('Summarize', PROMPT_TEMPLATES.summarize);
            createTemplateBtn('Analyze', PROMPT_TEMPLATES.analyze);

            const promptActionContainer = commandDetails.createDiv({ cls: 'prompt-action-container' });
            
            const clearBtn = promptActionContainer.createEl('button', { 
                cls: 'prompt-action-btn prompt-clear-btn',
                text: 'Clear Prompt' 
            });
            clearBtn.addEventListener('click', async () => {
                textArea.setValue('');
                this.plugin.settings.customCommands[index].promptTemplate = '';
                await this.plugin.saveSettings();
            });

            const commandActionContainer = commandDetails.createDiv({ cls: 'command-action-container' });
            
            const cancelBtn = commandActionContainer.createEl('button', { 
                cls: 'command-action-btn cancel-btn',
                text: 'Cancel' 
            });
            cancelBtn.addEventListener('click', () => {
                commandDetails.addClass('hidden');
                chevron.removeClass('expanded');
            });

            const saveBtn = commandActionContainer.createEl('button', { 
                cls: 'command-action-btn save-btn',
                text: 'Save' 
            });
            saveBtn.addEventListener('click', async () => {
                await this.plugin.saveSettings();
                commandDetails.addClass('hidden');
                chevron.removeClass('expanded');
            });
        });

        new Setting(containerEl)
            .addButton(button => button
                .setButtonText('+ Add Command')
                .setCta()
                .onClick(async () => {
                    const newCommand: CustomCommand = {
                        id: Date.now().toString(),
                        provider: 'gemini',
                        modelId: 'gemini-2.0-flash-exp',
                        name: 'New Command',
                        command: '/new',
                        promptTemplate: 'You are an expert knowledge synthesizer. Output in Markdown.'
                    };
                    this.plugin.settings.customCommands.push(newCommand);
                    await this.plugin.saveSettings();
                    this.display();
                }));
    }
}
