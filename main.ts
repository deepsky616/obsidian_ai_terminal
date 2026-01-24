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

const DEFAULT_CUSTOM_COMMANDS: CustomCommand[] = [
    { id: '1', provider: 'gemini', modelId: 'gemini-2.0-flash-exp', name: 'Gemini Flash', command: '/gemini', promptTemplate: 'You are an expert knowledge synthesizer. Output in Markdown.' },
    { id: '2', provider: 'openai', modelId: 'gpt-4o-mini', name: 'GPT-4o Mini', command: '/gpt', promptTemplate: 'You are an expert knowledge synthesizer. Output in Markdown.' },
    { id: '3', provider: 'anthropic', modelId: 'claude-3-5-haiku-latest', name: 'Claude Haiku', command: '/claude', promptTemplate: 'You are an expert knowledge synthesizer. Output in Markdown.' },
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

        // Custom Commands Section
        containerEl.createEl('h3', { text: 'Custom Commands' });
        containerEl.createEl('p', { 
            text: 'Create custom slash commands with any model and prompt template. Use commands like /summarize or /translate in chat.',
            cls: 'setting-item-description'
        });

        const commands = this.plugin.settings.customCommands;
        
        commands.forEach((cmd, index) => {
            const cmdContainer = containerEl.createDiv({ cls: 'ai-terminal-model-config' });
            
            const headerDiv = cmdContainer.createDiv({ cls: 'model-config-header' });
            headerDiv.createEl('h4', { text: cmd.name || 'New Command', cls: 'model-config-title' });
            
            const deleteBtn = headerDiv.createEl('button', { 
                cls: 'mod-warning command-delete-btn',
                text: 'Delete'
            });
            deleteBtn.addEventListener('click', async () => {
                this.plugin.settings.customCommands.splice(index, 1);
                await this.plugin.saveSettings();
                this.display();
            });

            new Setting(cmdContainer)
                .setName('Name')
                .setDesc('Display name for this command')
                .addText(text => text
                    .setPlaceholder('My Custom Command')
                    .setValue(cmd.name)
                    .onChange(async (value) => {
                        this.plugin.settings.customCommands[index].name = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(cmdContainer)
                .setName('Command')
                .setDesc('Slash command to trigger (e.g., /summarize)')
                .addText(text => text
                    .setPlaceholder('/command')
                    .setValue(cmd.command)
                    .onChange(async (value) => {
                        this.plugin.settings.customCommands[index].command = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(cmdContainer)
                .setName('Provider')
                .setDesc('AI provider to use')
                .addDropdown(dropdown => dropdown
                    .addOption('gemini', 'Google Gemini')
                    .addOption('openai', 'OpenAI')
                    .addOption('anthropic', 'Anthropic')
                    .setValue(cmd.provider)
                    .onChange(async (value: 'gemini' | 'openai' | 'anthropic') => {
                        this.plugin.settings.customCommands[index].provider = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(cmdContainer)
                .setName('Model ID')
                .setDesc('The API model identifier (e.g., gpt-4o-mini, gemini-2.0-flash-exp)')
                .addText(text => text
                    .setPlaceholder('model-id')
                    .setValue(cmd.modelId)
                    .onChange(async (value) => {
                        this.plugin.settings.customCommands[index].modelId = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(cmdContainer)
                .setName('Prompt Template')
                .setDesc('System prompt for this command');
            
            const textAreaContainer = cmdContainer.createDiv({ cls: 'prompt-template-container' });
            const textArea = new TextAreaComponent(textAreaContainer);
            textArea
                .setPlaceholder('Enter system prompt template...')
                .setValue(cmd.promptTemplate);
            textArea.inputEl.rows = 4;
            textArea.inputEl.style.width = '100%';
            textArea.onChange(async (value) => {
                this.plugin.settings.customCommands[index].promptTemplate = value;
                await this.plugin.saveSettings();
            });
        });

        new Setting(containerEl)
            .setName('Add New Command')
            .setDesc('Create a new custom command')
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
