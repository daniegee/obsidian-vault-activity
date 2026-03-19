type ElementOptions = {
	cls?: string;
	text?: string;
	attr?: Record<string, string>;
};

export class MockElement {
	tagName: string;
	classes: string[] = [];
	textContent = "";
	attrs: Record<string, string> = {};
	children: MockElement[] = [];
	onclick: ((event: any) => unknown) | null = null;
	onkeydown: ((event: any) => unknown) | null = null;
	private readonly listeners = new Map<
		string,
		Array<(event: any) => unknown>
	>();
	style = {
		setProperty: (name: string, value: string) => {
			this.styleValues[name] = value;
		},
	};
	classList = {
		add: (...tokens: string[]) => {
			this.addClass(tokens.join(" "));
		},
		toggle: (token: string, force?: boolean) => {
			const has = this.classes.includes(token);
			const shouldAdd = force ?? !has;
			if (shouldAdd && !has) {
				this.classes.push(token);
			}
			if (!shouldAdd && has) {
				this.classes = this.classes.filter((cls) => cls !== token);
			}
			return shouldAdd;
		},
		contains: (token: string) => this.classes.includes(token),
	};

	private styleValues: Record<string, string> = {};

	constructor(tagName: string) {
		this.tagName = tagName;
	}

	empty(): void {
		this.children = [];
	}

	addClass(cls: string): void {
		for (const token of cls.split(/\s+/).filter(Boolean)) {
			if (!this.classes.includes(token)) {
				this.classes.push(token);
			}
		}
	}

	setAttribute(name: string, value: string): void {
		this.attrs[name] = value;
		if (name === "class") {
			this.addClass(value);
		}
	}

	setAttr(name: string, value: string): void {
		this.setAttribute(name, value);
	}

	setText(text: string): void {
		this.textContent = text;
	}

	createDiv(options: ElementOptions = {}): MockElement {
		return this.createChild("div", options);
	}

	createSpan(options: ElementOptions = {}): MockElement {
		return this.createChild("span", options);
	}

	createEl(tagName: string, options: ElementOptions = {}): MockElement {
		return this.createChild(tagName, options);
	}

	appendChild(child: MockElement): MockElement {
		this.children.push(child);
		return child;
	}

	addEventListener(type: string, handler: (event: any) => unknown): void {
		const handlers = this.listeners.get(type) ?? [];
		handlers.push(handler);
		this.listeners.set(type, handlers);
	}

	dispatch(type: string, event: any = {}): void {
		for (const handler of this.listeners.get(type) ?? []) {
			handler(event);
		}
	}

	findByClass(targetClass: string): MockElement[] {
		const matches: MockElement[] = [];
		if (this.classes.includes(targetClass)) {
			matches.push(this);
		}
		for (const child of this.children) {
			matches.push(...child.findByClass(targetClass));
		}
		return matches;
	}

	findByTag(tagName: string): MockElement[] {
		const matches: MockElement[] = [];
		if (this.tagName.toLowerCase() === tagName.toLowerCase()) {
			matches.push(this);
		}
		for (const child of this.children) {
			matches.push(...child.findByTag(tagName));
		}
		return matches;
	}

	private createChild(tagName: string, options: ElementOptions): MockElement {
		const child = new MockElement(tagName);
		if (options.cls) {
			child.addClass(options.cls);
		}
		if (options.text) {
			child.textContent = options.text;
		}
		if (options.attr) {
			for (const [key, value] of Object.entries(options.attr)) {
				child.setAttribute(key, value);
			}
		}
		this.children.push(child);
		return child;
	}
}

export function installMockDocument(): () => void {
	const original = globalThis.document;
	const mockDocument = {
		createElementNS: (_namespace: string, tagName: string) =>
			new MockElement(tagName),
	} as unknown as Document;

	Object.defineProperty(globalThis, "document", {
		value: mockDocument,
		configurable: true,
		writable: true,
	});

	return () => {
		Object.defineProperty(globalThis, "document", {
			value: original,
			configurable: true,
			writable: true,
		});
	};
}
