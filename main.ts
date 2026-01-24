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
            
            const chevron = commandHeader.createEl('span', { cls: 'command-chevron', text: '›' });
            
            const commandDetails = commandItem.createDiv({ cls: 'command-details hidden' });
            
            commandHeader.addEventListener('click', () => {
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
                .addText(text => text
                    .setValue(cmd.name)
                    .onChange(async (value) => {
                        this.plugin.settings.customCommands[index].name = value;
                        await this.plugin.saveSettings();
                        commandInfo.querySelector('.command-name')!.textContent = value;
                    }));

            new Setting(commandDetails)
                .setName('Command')
                .addText(text => text
                    .setValue(cmd.command)
                    .onChange(async (value) => {
                        this.plugin.settings.customCommands[index].command = value;
                        await this.plugin.saveSettings();
                        commandInfo.querySelector('.command-slash')!.textContent = value;
                    }));

            new Setting(commandDetails)
                .setName('Provider')
                .addDropdown(dropdown => dropdown
                    .addOption('gemini', 'Google Gemini')
                    .addOption('openai', 'OpenAI')
                    .addOption('anthropic', 'Anthropic')
                    .setValue(cmd.provider)
                    .onChange(async (value: 'gemini' | 'openai' | 'anthropic') => {
                        this.plugin.settings.customCommands[index].provider = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(commandDetails)
                .setName('Model ID')
                .addText(text => text
                    .setValue(cmd.modelId)
                    .onChange(async (value) => {
                        this.plugin.settings.customCommands[index].modelId = value;
                        await this.plugin.saveSettings();
                    }));

            const promptSetting = new Setting(commandDetails).setName('Prompt Template');
            const textAreaContainer = commandDetails.createDiv({ cls: 'prompt-template-container' });
            const textArea = new TextAreaComponent(textAreaContainer);
            textArea.setValue(cmd.promptTemplate);
            textArea.inputEl.rows = 4;
            textArea.inputEl.style.width = '100%';
            textArea.onChange(async (value) => {
                this.plugin.settings.customCommands[index].promptTemplate = value;
                await this.plugin.saveSettings();
            });

            new Setting(commandDetails)
                .addButton(button => button
                    .setButtonText('Delete Command')
                    .setWarning()
                    .onClick(async () => {
                        this.plugin.settings.customCommands.splice(index, 1);
                        await this.plugin.saveSettings();
                        this.display();
                    }));
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
