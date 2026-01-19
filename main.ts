import { App, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from 'obsidian';
import { TerminalView, TERMINAL_VIEW_TYPE } from './src/TerminalView';

interface PluginSettings {
    googleApiKey: string;
    openaiApiKey: string;
    anthropicApiKey: string;
    defaultFolder: string;
}

const DEFAULT_SETTINGS: PluginSettings = {
    googleApiKey: '',
    openaiApiKey: '',
    anthropicApiKey: '',
    defaultFolder: ''
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
        this.addRibbonIcon('terminal', 'Open AI Terminal', () => {
            this.activateView();
        });

        this.addCommand({
            id: 'open-ai-terminal',
            name: 'Open AI Terminal',
            callback: () => {
                this.activateView();
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
    }
}
