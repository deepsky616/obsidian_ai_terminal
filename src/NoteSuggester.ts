import { App, FuzzySuggestModal, TFile, Modal } from "obsidian";

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

// Multi-select note modal
export class MultiNoteSuggester extends Modal {
    app: App;
    onSubmit: (files: TFile[]) => void;
    selectedFiles: Set<TFile> = new Set();
    allFiles: TFile[];
    filterText: string = "";
    listContainer: HTMLElement;

    constructor(app: App, currentlyPinned: TFile[], onSubmit: (files: TFile[]) => void) {
        super(app);
        this.app = app;
        this.onSubmit = onSubmit;
        this.allFiles = this.app.vault.getMarkdownFiles();
        // Pre-select currently pinned files
        currentlyPinned.forEach(f => this.selectedFiles.add(f));
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("multi-note-suggester");

        contentEl.createEl("h3", { text: "Select Notes to Pin" });

        // Search input
        const searchInput = contentEl.createEl("input", {
            type: "text",
            placeholder: "Search notes...",
            cls: "multi-note-search"
        });

        searchInput.addEventListener("input", (e) => {
            this.filterText = (e.target as HTMLInputElement).value.toLowerCase();
            this.renderList();
        });

        // Selected count
        const countEl = contentEl.createDiv({ cls: "multi-note-count" });

        // List container
        this.listContainer = contentEl.createDiv({ cls: "multi-note-list" });

        // Buttons
        const buttonContainer = contentEl.createDiv({ cls: "multi-note-buttons" });

        const selectAllBtn = buttonContainer.createEl("button", { text: "Select All" });
        selectAllBtn.onclick = () => {
            const filtered = this.getFilteredFiles();
            filtered.forEach(f => this.selectedFiles.add(f));
            this.renderList();
            this.updateCount(countEl);
        };

        const clearBtn = buttonContainer.createEl("button", { text: "Clear All" });
        clearBtn.onclick = () => {
            this.selectedFiles.clear();
            this.renderList();
            this.updateCount(countEl);
        };

        const submitBtn = buttonContainer.createEl("button", { text: "Done", cls: "mod-cta" });
        submitBtn.onclick = () => {
            this.onSubmit(Array.from(this.selectedFiles));
            this.close();
        };

        const cancelBtn = buttonContainer.createEl("button", { text: "Cancel" });
        cancelBtn.onclick = () => this.close();

        this.renderList();
        this.updateCount(countEl);
        searchInput.focus();
    }

    getFilteredFiles(): TFile[] {
        if (!this.filterText) return this.allFiles;
        return this.allFiles.filter(f =>
            f.path.toLowerCase().includes(this.filterText) ||
            f.basename.toLowerCase().includes(this.filterText)
        );
    }

    async renderList() {
        this.listContainer.empty();
        const filtered = this.getFilteredFiles();

        for (const file of filtered) {
            const item = this.listContainer.createDiv({ cls: "multi-note-item" });
            const isSelected = this.selectedFiles.has(file);

            const checkbox = item.createEl("input", {
                type: "checkbox",
                cls: "multi-note-checkbox"
            });
            checkbox.checked = isSelected;
            checkbox.onchange = () => {
                if (checkbox.checked) {
                    this.selectedFiles.add(file);
                } else {
                    this.selectedFiles.delete(file);
                }
                this.updateCount(this.contentEl.querySelector(".multi-note-count") as HTMLElement);
            };

            const fileContent = item.createDiv({ cls: "file-content-wrapper" });

            const fileHeader = fileContent.createDiv({ cls: "file-header" });
            const fileName = fileHeader.createEl("span", {
                text: file.path,
                cls: isSelected ? "selected file-name" : "file-name"
            });

            // Preview button
            const previewBtn = fileHeader.createEl("button", {
                text: "👁",
                cls: "preview-btn"
            });

            const previewDiv = fileContent.createDiv({ cls: "file-preview hidden" });

            previewBtn.onclick = async (e) => {
                e.stopPropagation();
                if (previewDiv.hasClass("hidden")) {
                    // Load and show preview
                    try {
                        const content = await this.app.vault.read(file);
                        const preview = content.substring(0, 300);
                        previewDiv.setText(preview + (content.length > 300 ? "..." : ""));
                        previewDiv.removeClass("hidden");
                        previewBtn.setText("🔼");
                    } catch (e: any) {
                        previewDiv.setText(`Error loading preview: ${e.message}`);
                        previewDiv.removeClass("hidden");
                    }
                } else {
                    previewDiv.addClass("hidden");
                    previewBtn.setText("👁");
                }
            };

            fileName.onclick = () => {
                checkbox.checked = !checkbox.checked;
                checkbox.onchange?.(new Event("change"));
            };
        }
    }

    updateCount(countEl: HTMLElement) {
        countEl.setText(`Selected: ${this.selectedFiles.size} notes`);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
