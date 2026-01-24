import { App, Plugin, PluginSettingTab, Setting, WorkspaceLeaf, TextAreaComponent } from 'obsidian';
import { TerminalView, TERMINAL_VIEW_TYPE } from './src/TerminalView';

export interface ModelConfig {
    id: string;
    name: string;
    command: string;
    promptTemplate: string;
}

export interface PluginSettings {
    googleApiKey: string;
    openaiApiKey: string;
    anthropicApiKey: string;
    defaultFolder: string;
    modelConfigs: {
        gemini: ModelConfig[];
        openai: ModelConfig[];
        anthropic: ModelConfig[];
    };
}

const DEFAULT_MODEL_CONFIGS = {
    gemini: [
        { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash', command: '/gemini-flash', promptTemplate: 'You are an expert knowledge synthesizer. Output in Markdown.' },
        { id: 'gemini-2.5-flash-exp', name: 'Gemini 2.5 Flash', command: '/gemini-flash-25', promptTemplate: 'You are an expert knowledge synthesizer. Output in Markdown.' }
    ],
    openai: [
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini', command: '/gpt-mini', promptTemplate: 'You are an expert knowledge synthesizer. Output in Markdown.' },
        { id: 'gpt-5-mini', name: 'GPT-5 Mini', command: '/gpt5-mini', promptTemplate: 'You are an expert knowledge synthesizer. Output in Markdown.' }
    ],
    anthropic: [
        { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku', command: '/claude-haiku', promptTemplate: 'You are an expert knowledge synthesizer. Output in Markdown.' },
        { id: 'claude-4-5-haiku-latest', name: 'Claude 4.5 Haiku', command: '/claude-haiku-45', promptTemplate: 'You are an expert knowledge synthesizer. Output in Markdown.' }
    ]
};

const DEFAULT_SETTINGS: PluginSettings = {
    googleApiKey: '',
    openaiApiKey: '',
    anthropicApiKey: '',
    defaultFolder: '',
    modelConfigs: DEFAULT_MODEL_CONFIGS
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

        // Model Configurations Section
        this.renderModelConfigSection(containerEl, 'Gemini Models', 'gemini');
        this.renderModelConfigSection(containerEl, 'OpenAI Models', 'openai');
        this.renderModelConfigSection(containerEl, 'Anthropic Models', 'anthropic');
    }

    renderModelConfigSection(containerEl: HTMLElement, title: string, provider: 'gemini' | 'openai' | 'anthropic') {
        containerEl.createEl('h3', { text: title });
        
        const models = this.plugin.settings.modelConfigs[provider];
        
        models.forEach((model, index) => {
            const modelContainer = containerEl.createDiv({ cls: 'ai-terminal-model-config' });
            modelContainer.createEl('h4', { text: model.name, cls: 'model-config-title' });

            // Model ID (read-only display)
            new Setting(modelContainer)
                .setName('Model ID')
                .setDesc('The API model identifier')
                .addText(text => text
                    .setValue(model.id)
                    .onChange(async (value) => {
                        this.plugin.settings.modelConfigs[provider][index].id = value;
                        await this.plugin.saveSettings();
                    }));

            // Display Name
            new Setting(modelContainer)
                .setName('Display Name')
                .setDesc('The name shown in the model selector')
                .addText(text => text
                    .setValue(model.name)
                    .onChange(async (value) => {
                        this.plugin.settings.modelConfigs[provider][index].name = value;
                        await this.plugin.saveSettings();
                    }));

            // Command
            new Setting(modelContainer)
                .setName('Command')
                .setDesc('Slash command to quickly select this model (e.g., /summarize)')
                .addText(text => text
                    .setPlaceholder('/command')
                    .setValue(model.command)
                    .onChange(async (value) => {
                        this.plugin.settings.modelConfigs[provider][index].command = value;
                        await this.plugin.saveSettings();
                    }));

            // Prompt Template
            new Setting(modelContainer)
                .setName('Prompt Template')
                .setDesc('System prompt template for this model');
            
            const textAreaContainer = modelContainer.createDiv({ cls: 'prompt-template-container' });
            const textArea = new TextAreaComponent(textAreaContainer);
            textArea
                .setPlaceholder('Enter system prompt template...')
                .setValue(model.promptTemplate);
            textArea.inputEl.rows = 4;
            textArea.inputEl.style.width = '100%';
            textArea.onChange(async (value) => {
                this.plugin.settings.modelConfigs[provider][index].promptTemplate = value;
                await this.plugin.saveSettings();
            });
        });

        // Add New Model Button
        new Setting(containerEl)
            .setName('Add New Model')
            .setDesc(`Add a new ${provider} model configuration`)
            .addButton(button => button
                .setButtonText('+ Add Model')
                .onClick(async () => {
                    const newModel: ModelConfig = {
                        id: `new-${provider}-model`,
                        name: `New ${provider.charAt(0).toUpperCase() + provider.slice(1)} Model`,
                        command: `/new-${provider}`,
                        promptTemplate: 'You are an expert knowledge synthesizer. Output in Markdown.'
                    };
                    this.plugin.settings.modelConfigs[provider].push(newModel);
                    await this.plugin.saveSettings();
                    this.display(); // Refresh settings UI
                }));
    }
}
