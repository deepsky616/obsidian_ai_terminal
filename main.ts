import { App, Plugin, PluginSettingTab, Setting, WorkspaceLeaf, TextAreaComponent, Notice } from 'obsidian';
import { TerminalView, TERMINAL_VIEW_TYPE } from './src/TerminalView';

export interface Skill {
    id: string;
    name: string;
    description: string;
    instructions: string;
    enabled: boolean;
}

export interface CustomCommand {
    id: string;
    provider: 'gemini' | 'openai' | 'claude';
    modelId: string;
    name: string;
    command: string;
    promptTemplate: string;
}

export interface PluginSettings {
    googleApiKey: string;
    openaiApiKey: string;
    claudeApiKey: string;
    defaultFolder: string;
    customCommands: CustomCommand[];
    skills: Skill[];
}

const PROMPT_TEMPLATES = {
    basic: 'You are an expert knowledge synthesizer. Output in Markdown.',
    obsidianNote: `You are an Obsidian note creation expert. Create notes with YAML frontmatter properties.

CRITICAL RULES:
1. Title MUST end with today's date in YYYYMMDD format (e.g., "My Topic 20260125")
2. YAML arrays MUST use bracket format: ["item1", "item2"]
3. String values with special characters MUST be quoted
4. created field format: "YYYY-MM-DD HH:mm"

Output this exact format:
---
title: "[Topic Title] YYYYMMDD"
tags: ["tag1", "tag2", "tag3"]
aliases: ["별칭1", "Alias2"]
created: "YYYY-MM-DD HH:mm"
type: ["Note"]
status: "작성완료"
priority: "Medium"
source: "AI Terminal"
related: ["[[Related Note 1]]", "[[Related Note 2]]"]
keywords: ["키워드1", "keyword2"]
summary: "Brief one-line summary of the content"
---

# [Topic Title] YYYYMMDD

## Content
Write well-structured content here.`,
    
    summarize: `You are an expert content summarizer for Obsidian notes.

CRITICAL RULES:
1. Title MUST end with today's date in YYYYMMDD format
2. YAML arrays MUST use bracket format: ["item1", "item2"]
3. All string values MUST be quoted

Output this exact format:
---
title: "Summary [Topic] YYYYMMDD"
tags: ["summary", "요약"]
aliases: []
created: "YYYY-MM-DD HH:mm"
type: ["Summary"]
status: "분석완료"
priority: "Medium"
source: "AI Terminal"
related: []
keywords: ["keyword1", "keyword2"]
summary: "One-line summary of key takeaways"
---

# Summary [Topic] YYYYMMDD

## 📌 핵심 요약
Brief summary paragraph.

## 🔑 핵심 포인트
- Point 1
- Point 2
- Point 3

## 📎 관련 주제
- [[Related Note 1]]
- [[Related Note 2]]`,

    analyze: `You are an expert analyst. Analyze the given content and create an Obsidian note.

CRITICAL RULES:
1. Title MUST end with today's date in YYYYMMDD format
2. YAML arrays MUST use bracket format: ["item1", "item2"]
3. All string values MUST be quoted

Output this exact format:
---
title: "Analysis [Topic] YYYYMMDD"
tags: ["analysis", "분석"]
aliases: []
created: "YYYY-MM-DD HH:mm"
type: ["Analysis"]
status: "분석완료"
priority: "Medium"
source: "AI Terminal"
related: []
keywords: ["keyword1", "keyword2"]
summary: "One-line summary of the analysis"
---

# Analysis [Topic] YYYYMMDD

## 📊 개요
Brief overview of what was analyzed.

## 🔍 주요 발견
1. Finding 1
2. Finding 2
3. Finding 3

## 💡 시사점
What this means and why it matters.

## ✅ 액션 아이템
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
    claude: [
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
    { id: '3', provider: 'claude', modelId: 'claude-haiku-4-5-20251001', name: 'Claude Haiku', command: '/claude', promptTemplate: PROMPT_TEMPLATES.basic },
];

const DEFAULT_SETTINGS: PluginSettings = {
    googleApiKey: '',
    openaiApiKey: '',
    claudeApiKey: '',
    defaultFolder: '',
    customCommands: DEFAULT_CUSTOM_COMMANDS,
    skills: []
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

    async saveSkillFile(skill: Skill) {
        const skillsDir = '.obsidian/skills';
        const folderExists = this.app.vault.getAbstractFileByPath(skillsDir);
        if (!folderExists) {
            await this.app.vault.createFolder(skillsDir);
        }
        const fileName = skill.name.replace(/[\\/:*?"<>|]/g, '-').toLowerCase();
        const filePath = `${skillsDir}/${fileName}/SKILL.md`;
        const subDir = `${skillsDir}/${fileName}`;
        const subDirExists = this.app.vault.getAbstractFileByPath(subDir);
        if (!subDirExists) {
            await this.app.vault.createFolder(subDir);
        }
        const content = `---\nname: ${skill.name}\ndescription: ${skill.description}\n---\n\n${skill.instructions}`;
        const existing = this.app.vault.getAbstractFileByPath(filePath);
        if (existing) {
            await this.app.vault.modify(existing as any, content);
        } else {
            await this.app.vault.create(filePath, content);
        }
    }

    async deleteSkillFile(skill: Skill) {
        const fileName = skill.name.replace(/[\\/:*?"<>|]/g, '-').toLowerCase();
        const dirPath = `.obsidian/skills/${fileName}`;
        const dir = this.app.vault.getAbstractFileByPath(dirPath);
        if (dir) {
            await this.app.vault.delete(dir, true);
        }
    }

    getActiveSkillsPrompt(): string {
        const activeSkills = this.settings.skills.filter(s => s.enabled);
        if (activeSkills.length === 0) return '';
        let prompt = '\n\n<skills>\n';
        activeSkills.forEach(skill => {
            prompt += `<skill name="${skill.name}">\n${skill.instructions}\n</skill>\n`;
        });
        prompt += '</skills>';
        return prompt;
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
            .setName('Claude API Key')
            .setDesc('Enter your Claude API Key')
            .addText(text => text
                .setPlaceholder('sk-ant-...')
                .setValue(this.plugin.settings.claudeApiKey)
                .onChange(async (value) => {
                    this.plugin.settings.claudeApiKey = value;
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
                    .addOption('claude', 'Claude')
                    .setValue(cmd.provider)
                    .onChange(async (value: 'gemini' | 'openai' | 'claude') => {
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

        // Skills Section
        containerEl.createEl('h3', { text: 'Skills' });
        containerEl.createEl('p', { 
            text: 'Add skills to extend AI capabilities. Skills are saved as SKILL.md files in .obsidian/skills/ and injected into system prompts.',
            cls: 'setting-item-description'
        });

        const skillsListContainer = containerEl.createDiv({ cls: 'command-list-container' });
        const skills = this.plugin.settings.skills;

        skills.forEach((skill, index) => {
            const skillItem = skillsListContainer.createDiv({ cls: 'command-list-item' });
            
            const skillHeader = skillItem.createDiv({ cls: 'command-list-header' });
            const skillInfo = skillHeader.createDiv({ cls: 'command-list-info' });
            
            const toggleEl = skillInfo.createEl('input', { 
                type: 'checkbox',
                cls: 'skill-toggle',
            }) as HTMLInputElement;
            toggleEl.checked = skill.enabled;
            toggleEl.addEventListener('click', async (e) => {
                e.stopPropagation();
                this.plugin.settings.skills[index].enabled = toggleEl.checked;
                await this.plugin.saveSettings();
            });

            skillInfo.createEl('span', { text: skill.name, cls: 'command-name' });
            skillInfo.createEl('span', { text: ` — ${skill.description}`, cls: 'skill-description-inline' });
            
            const headerActions = skillHeader.createDiv({ cls: 'command-header-actions' });
            const deleteBtn = headerActions.createEl('button', { 
                cls: 'command-delete-btn',
                attr: { 'aria-label': 'Delete skill' }
            });
            deleteBtn.innerHTML = '×';
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.plugin.deleteSkillFile(skill);
                this.plugin.settings.skills.splice(index, 1);
                await this.plugin.saveSettings();
                this.display();
            });
            
            const chevron = headerActions.createEl('span', { cls: 'command-chevron', text: '›' });
            
            const skillDetails = skillItem.createDiv({ cls: 'command-details hidden' });
            
            skillHeader.addEventListener('click', (e) => {
                if ((e.target as HTMLElement).closest('.command-delete-btn') || (e.target as HTMLElement).closest('.skill-toggle')) return;
                
                const isHidden = skillDetails.hasClass('hidden');
                skillsListContainer.querySelectorAll('.command-details').forEach(el => el.addClass('hidden'));
                skillsListContainer.querySelectorAll('.command-chevron').forEach(el => el.removeClass('expanded'));
                
                if (isHidden) {
                    skillDetails.removeClass('hidden');
                    chevron.addClass('expanded');
                }
            });

            new Setting(skillDetails)
                .setName('Name')
                .setDesc('Unique skill name (used as folder name)')
                .addText(text => text
                    .setPlaceholder('e.g., code-review')
                    .setValue(skill.name)
                    .onChange(async (value) => {
                        this.plugin.settings.skills[index].name = value;
                        await this.plugin.saveSettings();
                        skillInfo.querySelector('.command-name')!.textContent = value;
                    }));

            new Setting(skillDetails)
                .setName('Description')
                .setDesc('Brief description of what this skill does and when to use it')
                .addText(text => text
                    .setPlaceholder('e.g., Expert code reviewer for TypeScript projects')
                    .setValue(skill.description)
                    .onChange(async (value) => {
                        this.plugin.settings.skills[index].description = value;
                        await this.plugin.saveSettings();
                    }));

            skillDetails.createEl('div', { cls: 'prompt-section-header', text: 'Instructions' });
            skillDetails.createEl('p', { 
                cls: 'prompt-section-desc',
                text: 'Detailed instructions, workflows, and guidance for the AI to follow when this skill is active.'
            });

            const textAreaContainer = skillDetails.createDiv({ cls: 'prompt-template-container' });
            const textArea = new TextAreaComponent(textAreaContainer);
            textArea.setValue(skill.instructions);
            textArea.inputEl.rows = 10;
            textArea.inputEl.style.width = '100%';
            textArea.onChange(async (value) => {
                this.plugin.settings.skills[index].instructions = value;
                await this.plugin.saveSettings();
            });

            const skillActionContainer = skillDetails.createDiv({ cls: 'command-action-container' });
            
            const cancelBtn = skillActionContainer.createEl('button', { 
                cls: 'command-action-btn cancel-btn',
                text: 'Cancel' 
            });
            cancelBtn.addEventListener('click', () => {
                skillDetails.addClass('hidden');
                chevron.removeClass('expanded');
            });

            const saveBtn = skillActionContainer.createEl('button', { 
                cls: 'command-action-btn save-btn',
                text: 'Save & Export' 
            });
            saveBtn.addEventListener('click', async () => {
                await this.plugin.saveSettings();
                await this.plugin.saveSkillFile(skill);
                skillDetails.addClass('hidden');
                chevron.removeClass('expanded');
                new Notice(`Skill "${skill.name}" saved to .obsidian/skills/`);
            });
        });

        new Setting(containerEl)
            .addButton(button => button
                .setButtonText('+ Add Skill')
                .setCta()
                .onClick(async () => {
                    const newSkill: Skill = {
                        id: Date.now().toString(),
                        name: 'new-skill',
                        description: 'Describe what this skill does',
                        instructions: '# Skill Name\n\n## Instructions\nAdd your instructions here.',
                        enabled: true
                    };
                    this.plugin.settings.skills.push(newSkill);
                    await this.plugin.saveSettings();
                    await this.plugin.saveSkillFile(newSkill);
                    this.display();
                }));
    }
}
