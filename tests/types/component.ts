import { asClassComponent, createClassComponent } from 'svelte/legacy';
import {
	SvelteComponent,
	type ComponentEvents,
	type ComponentProps,
	type ComponentType,
	mount,
	hydrate,
	type Component,
	type ComponentInternals
} from 'svelte';
import { render } from 'svelte/server';

SvelteComponent.element === HTMLElement;

// --------------------------------------------------------------------------- legacy: classes

class LegacyComponent extends SvelteComponent<
	{ prop: string },
	{ event: MouseEvent },
	{ slot: { slotProps: boolean } }
> {}

const legacyComponent = new LegacyComponent({
	target: null as any as Document | Element | ShadowRoot,
	props: {
		prop: 'foo',
		// @ts-expect-error
		x: ''
	}
});

const legacyComponentType: ComponentType<LegacyComponent> = LegacyComponent;

const legacyComponentProps1: ComponentProps<LegacyComponent> = {
	prop: '',
	// @ts-expect-error
	x: ''
};
const legacyComponentProps2: ComponentProps<LegacyComponent> = {
	// @ts-expect-error
	prop: 1
};

const legacyComponentEvents1: ComponentEvents<LegacyComponent> = {
	event: new MouseEvent('click'),
	// @ts-expect-error
	x: ''
};
const legacyComponentEvents2: ComponentEvents<LegacyComponent> = {
	// @ts-expect-error
	event: new KeyboardEvent('click')
};

const legacyComponentInstance: SvelteComponent<{ prop: string }> = new LegacyComponent({
	target: null as any as Document | Element | ShadowRoot,
	props: {
		prop: 'foo'
	}
});

const legacyComponentClass: typeof SvelteComponent<{ prop: string }> = LegacyComponent;

// --------------------------------------------------------------------------- new: functions

class NewComponent extends SvelteComponent<
	{ prop: string },
	{ event: MouseEvent },
	{ slot: { slotProps: boolean } }
> {
	anExport: string = '';
}

new NewComponent({
	target: null as any,
	props: {
		prop: 'foo',
		// @ts-expect-error
		x: ''
	}
});

const newComponent: NewComponent = new NewComponent({
	target: null as any,
	props: {
		prop: 'foo'
	}
});
newComponent.$$events_def.event;
// @ts-expect-error
newComponent.$$events_def.x;
newComponent.$$slot_def.slot;
// @ts-expect-error
newComponent.$$slot_def.x;
newComponent.anExport === '';
// @ts-expect-error
newComponent.anExport === 1;

const newComponentType: ComponentType<NewComponent> = NewComponent;

const newComponentProps1: ComponentProps<NewComponent> = {
	prop: '',
	// @ts-expect-error
	x: ''
};
const newComponentProps2: ComponentProps<NewComponent> = {
	// @ts-expect-error
	prop: 1
};

const newComponentEvents1: ComponentEvents<NewComponent> = {
	event: new MouseEvent('click'),
	// @ts-expect-error
	x: ''
};
const newComponentEvents2: ComponentEvents<NewComponent> = {
	// @ts-expect-error
	event: new KeyboardEvent('click')
};

mount(NewComponent, {
	target: null as any as Document | Element | ShadowRoot,
	props: {
		prop: 'foo',
		// @ts-expect-error
		x: ''
	},
	events: {
		event: (e) => e.offsetX
	},
	immutable: true,
	intro: false,
	recover: false
});
mount(
	NewComponent,
	// @ts-expect-error props missing
	{ target: null as any }
);
// if component receives no args, props can be omitted
mount(null as any as typeof SvelteComponent<{}>, { target: null as any });

hydrate(NewComponent, {
	target: null as any as Document | Element | ShadowRoot,
	props: {
		prop: 'foo',
		// @ts-expect-error
		x: ''
	},
	events: {
		event: (e) =>
			// we're not type checking this as it's an edge case and removing the generic later would be an annoying mini breaking change
			e.doesNotExist
	},
	immutable: true,
	intro: false,
	recover: false
});
hydrate(
	NewComponent,
	// @ts-expect-error props missing
	{ target: null as any }
);
// if component receives no args, props can be omitted
hydrate(null as any as typeof SvelteComponent<{}>, { target: null as any });

render(NewComponent, {
	props: {
		prop: 'foo',
		// @ts-expect-error
		x: ''
	}
});
// @ts-expect-error
render(NewComponent);
render(NewComponent, {
	props: {
		// @ts-expect-error
		prop: 1
	}
});

// --------------------------------------------------------------------------- interop

const AsLegacyComponent = asClassComponent(newComponent);
new AsLegacyComponent({
	target: null as any,
	props: {
		prop: '',
		// @ts-expect-error
		x: ''
	}
});
const asLegacyComponent = new AsLegacyComponent({
	target: null as any,
	props: {
		prop: ''
	}
});
asLegacyComponent.$on('event', (e) => e.clientX);
// @ts-expect-error
asLegacyComponent.$on('event', (e) => e.foo);
// @ts-expect-error
asLegacyComponent.$on('bar', (e) => e);
asLegacyComponent.$$prop_def.prop = '';
asLegacyComponent.anExport = '';
// @ts-expect-error
asLegacyComponent.$$prop_def.anExport = 1;
// @ts-expect-error
asLegacyComponent.$$prop_def.prop = 1;
// @ts-expect-error
asLegacyComponent.$$prop_def.x = '';
asLegacyComponent.anExport;
const x: typeof asLegacyComponent = createClassComponent({
	target: null as any,
	hydrate: true,
	component: NewComponent
});

// --------------------------------------------------------------------------- function component

const functionComponent: Component<
	{ binding: boolean; readonly: string },
	{ foo: 'bar' },
	'binding'
> = (a, props) => {
	props.binding === true;
	props.readonly === 'foo';
	// @ts-expect-error
	props.readonly = true;
	// @ts-expect-error
	props.binding = '';
	return {
		foo: 'bar'
	};
};
functionComponent.element === HTMLElement;

const bindingIsOkayToWiden: Component<any> = functionComponent;

functionComponent(null as any, {
	binding: true,
	// @ts-expect-error
	readonly: true
});

const functionComponentInstance = functionComponent(null as any, {
	binding: true,
	readonly: 'foo',
	// @ts-expect-error
	x: ''
});
functionComponentInstance.foo === 'bar';
// @ts-expect-error
functionComponentInstance.foo = 'foo';

const functionComponentProps: ComponentProps<typeof functionComponent> = {
	binding: true,
	readonly: 'foo',
	// @ts-expect-error
	prop: 1
};

mount(functionComponent, {
	target: null as any as Document | Element | ShadowRoot,
	props: {
		binding: true,
		readonly: 'foo',
		// would be nice to error here, probably needs NoInfer type helper in upcoming TS 5.5
		x: ''
	}
});
mount(functionComponent, {
	target: null as any as Document | Element | ShadowRoot,
	props: {
		binding: true,
		// @ts-expect-error wrong type
		readonly: 1
	}
});
mount(
	functionComponent,
	// @ts-expect-error props missing
	{ target: null as any }
);
// if component receives no args, props can be omitted
mount(null as any as Component<{}>, { target: null as any });

hydrate(functionComponent, {
	target: null as any as Document | Element | ShadowRoot,
	props: {
		binding: true,
		readonly: 'foo',
		// would be nice to error here, probably needs NoInfer type helper in upcoming TS 5.5
		x: ''
	}
});
hydrate(functionComponent, {
	target: null as any as Document | Element | ShadowRoot,
	// @ts-expect-error missing prop
	props: {
		binding: true
	}
});
hydrate(
	functionComponent,
	// @ts-expect-error props missing
	{ target: null as any }
);
// if component receives no args, props can be omitted
hydrate(null as any as Component<{}>, { target: null as any });

render(functionComponent, {
	props: {
		binding: true,
		readonly: 'foo'
	}
});
// @ts-expect-error
render(functionComponent);
render(functionComponent, {
	// @ts-expect-error
	props: {
		binding: true
	}
});
render(functionComponent, {
	props: {
		binding: true,
		// @ts-expect-error
		readonly: 1
	}
});

// --------------------------------------------------------------------------- *.svelte components

// import from a nonexistent file to trigger the declare module '*.svelte' in ambient.d.ts
// this could show an error in the future in the editor (because language tools intercepts and knows this is an error)
// but should always pass in tsc (because it will never know about this fact)
import Foo from './doesntexist.svelte';

Foo(null as unknown as ComponentInternals, { a: true });
const f: Foo = new Foo({ target: document.body, props: { a: true } });
