/** @import * as ESTree from 'estree' */
/** @import { ValidatedCompileOptions, SvelteNode, ValidatedModuleCompileOptions } from '#compiler' */
/** @import { ComponentAnalysis, Analysis } from '../../types' */
/** @import { Visitors, ComponentClientTransformState, ClientTransformState } from './types' */
import { walk } from 'zimmerframe';
import * as b from '../../../utils/builders.js';
import { set_scope } from '../../scope.js';
import { template_visitors } from './visitors/template.js';
import { global_visitors } from './visitors/global.js';
import { javascript_visitors } from './visitors/javascript.js';
import { javascript_visitors_runes } from './visitors/javascript-runes.js';
import { javascript_visitors_legacy } from './visitors/javascript-legacy.js';
import { serialize_get_binding } from './utils.js';
import { render_stylesheet } from '../css/index.js';
import { filename } from '../../../state.js';

/**
 * This function ensures visitor sets don't accidentally clobber each other
 * @param  {...Visitors} array
 * @returns {Visitors}
 */
function combine_visitors(...array) {
	/** @type {Record<string, any>} */
	const visitors = {};

	for (const member of array) {
		for (const key in member) {
			if (visitors[key]) {
				throw new Error(`Duplicate visitor: ${key}`);
			}

			// @ts-ignore
			visitors[key] = member[key];
		}
	}

	return visitors;
}

/**
 * @param {string} source
 * @param {ComponentAnalysis} analysis
 * @param {ValidatedCompileOptions} options
 * @returns {ESTree.Program}
 */
export function client_component(source, analysis, options) {
	/** @type {ComponentClientTransformState} */
	const state = {
		analysis,
		options,
		scope: analysis.module.scope,
		scopes: analysis.template.scopes,
		hoisted: [b.import_all('$', 'svelte/internal/client')],
		node: /** @type {any} */ (null), // populated by the root node
		legacy_reactive_statements: new Map(),
		metadata: {
			context: {
				template_needs_import_node: false,
				template_contains_script_tag: false
			},
			namespace: options.namespace,
			bound_contenteditable: false
		},
		events: new Set(),
		preserve_whitespace: options.preserveWhitespace,
		public_state: new Map(),
		private_state: new Map(),
		in_constructor: false,

		// these are set inside the `Fragment` visitor, and cannot be used until then
		before_init: /** @type {any} */ (null),
		init: /** @type {any} */ (null),
		update: /** @type {any} */ (null),
		after_update: /** @type {any} */ (null),
		template: /** @type {any} */ (null),
		locations: /** @type {any} */ (null)
	};

	const module = /** @type {ESTree.Program} */ (
		walk(
			/** @type {SvelteNode} */ (analysis.module.ast),
			state,
			combine_visitors(
				set_scope(analysis.module.scopes),
				global_visitors,
				// @ts-expect-error TODO
				javascript_visitors,
				analysis.runes ? javascript_visitors_runes : javascript_visitors_legacy
			)
		)
	);

	const instance_state = { ...state, scope: analysis.instance.scope };
	const instance = /** @type {ESTree.Program} */ (
		walk(
			/** @type {SvelteNode} */ (analysis.instance.ast),
			instance_state,
			combine_visitors(
				set_scope(analysis.instance.scopes),
				global_visitors,
				// @ts-expect-error TODO
				javascript_visitors,
				analysis.runes ? javascript_visitors_runes : javascript_visitors_legacy,
				{
					ImportDeclaration(node) {
						state.hoisted.push(node);
						return b.empty;
					},
					ExportNamedDeclaration(node, context) {
						if (node.declaration) {
							return context.visit(node.declaration);
						}

						return b.empty;
					}
				}
			)
		)
	);

	const template = /** @type {ESTree.Program} */ (
		walk(
			/** @type {SvelteNode} */ (analysis.template.ast),
			{ ...state, scope: analysis.instance.scope },
			combine_visitors(
				set_scope(analysis.template.scopes),
				global_visitors,
				// @ts-expect-error TODO
				template_visitors
			)
		)
	);

	// Very very dirty way of making import statements reactive in legacy mode if needed
	if (!analysis.runes) {
		for (const [name, binding] of analysis.module.scope.declarations) {
			if (binding.kind === 'legacy_reactive_import') {
				instance.body.unshift(
					b.var('$$_import_' + name, b.call('$.reactive_import', b.thunk(b.id(name))))
				);
			}
		}
	}

	/** @type {ESTree.Statement[]} */
	const store_setup = [];

	/** @type {ESTree.VariableDeclaration[]} */
	const legacy_reactive_declarations = [];

	for (const [name, binding] of analysis.instance.scope.declarations) {
		if (binding.kind === 'legacy_reactive') {
			legacy_reactive_declarations.push(b.const(name, b.call('$.mutable_source')));
		}
		if (binding.kind === 'store_sub') {
			if (store_setup.length === 0) {
				store_setup.push(b.const('$$stores', b.call('$.setup_stores')));
			}

			// We're creating an arrow function that gets the store value which minifies better for two or more references
			const store_reference = serialize_get_binding(b.id(name.slice(1)), instance_state);
			const store_get = b.call('$.store_get', store_reference, b.literal(name), b.id('$$stores'));
			store_setup.push(
				b.const(
					binding.node,
					options.dev
						? b.thunk(
								b.sequence([
									b.call('$.validate_store', store_reference, b.literal(name.slice(1))),
									store_get
								])
							)
						: b.thunk(store_get)
				)
			);
		}
	}

	for (const [node] of analysis.reactive_statements) {
		const statement = [...state.legacy_reactive_statements].find(([n]) => n === node);
		if (statement === undefined) {
			throw new Error('Could not find reactive statement');
		}
		instance.body.push(statement[1]);
	}

	if (analysis.reactive_statements.size > 0) {
		instance.body.push(b.stmt(b.call('$.legacy_pre_effect_reset')));
	}

	/**
	 * Used to store the group nodes
	 * @type {ESTree.VariableDeclaration[]}
	 */
	const group_binding_declarations = [];
	for (const group of analysis.binding_groups.values()) {
		group_binding_declarations.push(b.const(group.name, b.array([])));
	}

	/** @type {Array<ESTree.Property | ESTree.SpreadElement>} */
	const component_returned_object = analysis.exports.flatMap(({ name, alias }) => {
		const binding = instance_state.scope.get(name);
		const expression = serialize_get_binding(b.id(name), instance_state);
		const getter = b.get(alias ?? name, [b.return(expression)]);

		if (expression.type === 'Identifier') {
			if (binding?.declaration_kind === 'let' || binding?.declaration_kind === 'var') {
				return [
					getter,
					b.set(alias ?? name, [b.stmt(b.assignment('=', expression, b.id('$$value')))])
				];
			} else if (!options.dev) {
				return b.init(alias ?? name, expression);
			}
		}

		if (binding?.kind === 'state' || binding?.kind === 'frozen_state') {
			return [
				getter,
				b.set(alias ?? name, [
					b.stmt(
						b.call(
							'$.set',
							b.id(name),
							b.call(binding.kind === 'state' ? '$.proxy' : '$.freeze', b.id('$$value'))
						)
					)
				])
			];
		}

		return getter;
	});

	const properties = [...analysis.instance.scope.declarations].filter(
		([name, binding]) =>
			(binding.kind === 'prop' || binding.kind === 'bindable_prop') && !name.startsWith('$$')
	);

	if (analysis.runes && options.dev) {
		const exports = analysis.exports.map(({ name, alias }) => b.literal(alias ?? name));
		/** @type {ESTree.Literal[]} */
		const bindable = [];
		for (const [name, binding] of properties) {
			if (binding.kind === 'bindable_prop') {
				bindable.push(b.literal(binding.prop_alias ?? name));
			}
		}
		instance.body.unshift(
			b.stmt(
				b.call(
					'$.validate_prop_bindings',
					b.id('$$props'),
					b.array(bindable),
					b.array(exports),
					b.id(`${analysis.name}`)
				)
			)
		);
	}

	if (analysis.accessors) {
		for (const [name, binding] of properties) {
			const key = binding.prop_alias ?? name;

			const getter = b.get(key, [b.return(b.call(b.id(name)))]);

			const setter = b.set(key, [
				b.stmt(b.call(b.id(name), b.id('$$value'))),
				b.stmt(b.call('$.flush_sync'))
			]);

			if (analysis.runes && binding.initial) {
				// turn `set foo($$value)` into `set foo($$value = expression)`
				setter.value.params[0] = {
					type: 'AssignmentPattern',
					left: b.id('$$value'),
					right: /** @type {ESTree.Expression} */ (binding.initial)
				};
			}

			component_returned_object.push(getter, setter);
		}
	}

	if (options.compatibility.componentApi === 4) {
		component_returned_object.push(
			b.init('$set', b.id('$.update_legacy_props')),
			b.init(
				'$on',
				b.arrow(
					[b.id('$$event_name'), b.id('$$event_cb')],
					b.call(
						'$.add_legacy_event_listener',
						b.id('$$props'),
						b.id('$$event_name'),
						b.id('$$event_cb')
					)
				)
			)
		);
	} else if (options.dev) {
		component_returned_object.push(b.spread(b.call(b.id('$.legacy_api'))));
	}

	const push_args = [b.id('$$props'), b.literal(analysis.runes)];
	if (options.dev) push_args.push(b.id(analysis.name));

	const component_block = b.block([
		...store_setup,
		...legacy_reactive_declarations,
		...group_binding_declarations,
		...analysis.top_level_snippets,
		.../** @type {ESTree.Statement[]} */ (instance.body),
		analysis.runes || !analysis.needs_context ? b.empty : b.stmt(b.call('$.init')),
		.../** @type {ESTree.Statement[]} */ (template.body)
	]);

	if (!analysis.runes) {
		// Bind static exports to props so that people can access them with bind:x
		for (const { name, alias } of analysis.exports) {
			component_block.body.push(
				b.stmt(
					b.call(
						'$.bind_prop',
						b.id('$$props'),
						b.literal(alias ?? name),
						serialize_get_binding(b.id(name), instance_state)
					)
				)
			);
		}
	}

	if (analysis.css.ast !== null && analysis.inject_styles) {
		const hash = b.literal(analysis.css.hash);
		const code = b.literal(render_stylesheet(analysis.source, analysis, options).code);

		state.hoisted.push(b.const('$$css', b.object([b.init('hash', hash), b.init('code', code)])));

		component_block.body.unshift(
			b.stmt(b.call('$.append_styles', b.id('$$anchor'), b.id('$$css')))
		);
	}

	const should_inject_context =
		analysis.needs_context ||
		analysis.reactive_statements.size > 0 ||
		component_returned_object.length > 0 ||
		options.dev;

	if (should_inject_context) {
		component_block.body.unshift(b.stmt(b.call('$.push', ...push_args)));

		component_block.body.push(
			component_returned_object.length > 0
				? b.return(b.call('$.pop', b.object(component_returned_object)))
				: b.stmt(b.call('$.pop'))
		);
	}

	if (analysis.uses_rest_props) {
		const named_props = analysis.exports.map(({ name, alias }) => alias ?? name);
		for (const [name, binding] of analysis.instance.scope.declarations) {
			if (binding.kind === 'bindable_prop') named_props.push(binding.prop_alias ?? name);
		}

		component_block.body.unshift(
			b.const(
				'$$restProps',
				b.call(
					'$.legacy_rest_props',
					b.id('$$sanitized_props'),
					b.array(named_props.map((name) => b.literal(name)))
				)
			)
		);
	}

	if (analysis.uses_props || analysis.uses_rest_props) {
		const to_remove = [
			b.literal('children'),
			b.literal('$$slots'),
			b.literal('$$events'),
			b.literal('$$legacy')
		];
		if (analysis.custom_element) {
			to_remove.push(b.literal('$$host'));
		}

		component_block.body.unshift(
			b.const(
				'$$sanitized_props',
				b.call('$.legacy_rest_props', b.id('$$props'), b.array(to_remove))
			)
		);
	}

	if (analysis.uses_slots) {
		component_block.body.unshift(b.const('$$slots', b.call('$.sanitize_slots', b.id('$$props'))));
	}

	let should_inject_props =
		should_inject_context ||
		analysis.needs_props ||
		analysis.uses_props ||
		analysis.uses_rest_props ||
		analysis.uses_slots ||
		analysis.slot_names.size > 0;

	const body = [...state.hoisted, ...module.body];

	const component = b.function_declaration(
		b.id(analysis.name),
		should_inject_props ? [b.id('$$anchor'), b.id('$$props')] : [b.id('$$anchor')],
		component_block
	);

	if (options.hmr) {
		const id = b.id(analysis.name);
		const HMR = b.id('$.HMR');

		const existing = b.member(id, HMR, true);
		const incoming = b.member(b.id('module.default'), HMR, true);

		const accept_fn_body = [
			b.stmt(
				b.assignment('=', b.member(incoming, b.id('source')), b.member(existing, b.id('source')))
			),
			b.stmt(
				b.call('$.set', b.member(existing, b.id('source')), b.member(incoming, b.id('original')))
			)
		];

		if (analysis.css.hash) {
			// remove existing `<style>` element, in case CSS changed
			accept_fn_body.unshift(
				b.stmt(
					b.call(
						b.member(
							b.call('document.querySelector', b.literal('#' + analysis.css.hash)),
							b.id('remove'),
							false,
							true
						)
					)
				)
			);
		}

		const hmr = b.block([
			b.stmt(
				b.assignment('=', id, b.call('$.hmr', id, b.thunk(b.member(existing, b.id('source')))))
			),

			b.stmt(b.call('import.meta.hot.accept', b.arrow([b.id('module')], b.block(accept_fn_body))))
		]);

		body.push(component, b.if(b.id('import.meta.hot'), hmr), b.export_default(b.id(analysis.name)));
	} else {
		body.push(b.export_default(component));
	}

	if (options.dev) {
		if (filename) {
			// add `App[$.FILENAME] = 'App.svelte'` so that we can print useful messages later
			body.unshift(
				b.stmt(
					b.assignment(
						'=',
						b.member(b.id(analysis.name), b.id('$.FILENAME'), true),
						b.literal(filename)
					)
				)
			);
		}

		body.unshift(b.stmt(b.call(b.id('$.mark_module_start'))));
		body.push(b.stmt(b.call(b.id('$.mark_module_end'), b.id(analysis.name))));
	}

	if (options.discloseVersion) {
		body.unshift(b.imports([], 'svelte/internal/disclose-version'));
	}

	if (options.compatibility.componentApi === 4) {
		body.unshift(b.imports([['createClassComponent', '$$_createClassComponent']], 'svelte/legacy'));
		component_block.body.unshift(
			b.if(
				b.id('new.target'),
				b.return(
					b.call(
						'$$_createClassComponent',
						// When called with new, the first argument is the constructor options
						b.object([b.init('component', b.id(analysis.name)), b.spread(b.id('$$anchor'))])
					)
				)
			)
		);
	} else if (options.dev) {
		component_block.body.unshift(b.stmt(b.call('$.check_target', b.id('new.target'))));
	}

	if (state.events.size > 0) {
		body.push(
			b.stmt(b.call('$.delegate', b.array(Array.from(state.events).map((name) => b.literal(name)))))
		);
	}

	if (analysis.custom_element) {
		const ce = analysis.custom_element;

		/** @type {ESTree.Property[]} */
		const props_str = [];

		for (const [name, binding] of properties) {
			const key = binding.prop_alias ?? name;
			const prop_def = typeof ce === 'boolean' ? {} : ce.props?.[key] || {};
			if (
				!prop_def.type &&
				binding.initial?.type === 'Literal' &&
				typeof binding.initial.value === 'boolean'
			) {
				prop_def.type = 'Boolean';
			}

			const value = b.object(
				/** @type {ESTree.Property[]} */ (
					[
						prop_def.attribute ? b.init('attribute', b.literal(prop_def.attribute)) : undefined,
						prop_def.reflect ? b.init('reflect', b.literal(true)) : undefined,
						prop_def.type ? b.init('type', b.literal(prop_def.type)) : undefined
					].filter(Boolean)
				)
			);
			props_str.push(b.init(key, value));
		}

		const slots_str = b.array([...analysis.slot_names.keys()].map((name) => b.literal(name)));
		const accessors_str = b.array(
			analysis.exports.map(({ name, alias }) => b.literal(alias ?? name))
		);
		const use_shadow_dom = typeof ce === 'boolean' || ce.shadow !== 'none' ? true : false;

		const create_ce = b.call(
			'$.create_custom_element',
			b.id(analysis.name),
			b.object(props_str),
			slots_str,
			accessors_str,
			b.literal(use_shadow_dom),
			/** @type {any} */ (typeof ce !== 'boolean' ? ce.extend : undefined)
		);

		// If customElement option is set, we define the custom element directly. Else we still create
		// the custom element class so that the user may instantiate a custom element themselves later.
		if (typeof ce !== 'boolean') {
			body.push(b.stmt(b.call('customElements.define', b.literal(ce.tag), create_ce)));
		} else {
			body.push(b.stmt(create_ce));
		}
	}

	return {
		type: 'Program',
		sourceType: 'module',
		body
	};
}

/**
 * @param {Analysis} analysis
 * @param {ValidatedModuleCompileOptions} options
 * @returns {ESTree.Program}
 */
export function client_module(analysis, options) {
	/** @type {ClientTransformState} */
	const state = {
		analysis,
		options,
		scope: analysis.module.scope,
		scopes: analysis.module.scopes,
		legacy_reactive_statements: new Map(),
		public_state: new Map(),
		private_state: new Map(),
		in_constructor: false
	};

	const module = /** @type {ESTree.Program} */ (
		walk(
			/** @type {SvelteNode} */ (analysis.module.ast),
			state,
			combine_visitors(
				set_scope(analysis.module.scopes),
				global_visitors,
				// @ts-expect-error
				javascript_visitors,
				javascript_visitors_runes
			)
		)
	);

	return {
		type: 'Program',
		sourceType: 'module',
		body: [b.import_all('$', 'svelte/internal/client'), ...module.body]
	};
}
