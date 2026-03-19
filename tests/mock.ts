export class Plugin {}

export class Notice {
	constructor(_message?: string) {}
}

export class WorkspaceLeaf {
	async setViewState(_state: unknown): Promise<void> {
		return;
	}
}

export class ItemView {
	app: any;
	contentEl: any;

	constructor(_leaf: WorkspaceLeaf) {
		this.app = {
			workspace: {
				openLinkText: async () => undefined,
			},
		};
		this.contentEl = {
			empty: () => undefined,
			addClass: () => undefined,
			createDiv: () => ({
				createEl: () => ({}),
				createDiv: () => ({
					createEl: () => ({}),
					createDiv: () => ({}),
				}),
				setText: () => undefined,
				addClass: () => undefined,
			}),
		};
	}
}

export class App {}

export class PluginSettingTab {
	app: unknown;
	plugin: unknown;
	containerEl: any;

	constructor(app: unknown, plugin: unknown) {
		this.app = app;
		this.plugin = plugin;
		this.containerEl = {
			empty: () => undefined,
			createEl: () => ({}),
		};
	}
}

export class Setting {
	constructor(_containerEl: unknown) {}
	setName(): this {
		return this;
	}
	setDesc(): this {
		return this;
	}
	addTextArea(_fn?: (text: any) => void): this {
		return this;
	}
	addDropdown(_fn?: (dropdown: any) => void): this {
		return this;
	}
	addText(_fn?: (text: any) => void): this {
		return this;
	}
	addToggle(_fn?: (toggle: any) => void): this {
		return this;
	}
}

export function setIcon(_el: unknown, _icon: string): void {
	return;
}
