import { App, FuzzySuggestModal, TFile } from "obsidian";

export class NoteSuggester extends FuzzySuggestModal<TFile> {
    onChoose: (result: TFile) => void;

    constructor(app: App, onChoose: (result: TFile) => void) {
        super(app);
        this.onChoose = onChoose;
    }

    getItems(): TFile[] {
        return this.app.vault.getMarkdownFiles();
    }

    getItemText(item: TFile): string {
        return item.path;
    }

    onChooseItem(item: TFile, evt: MouseEvent | KeyboardEvent): void {
        this.onChoose(item);
    }
}
