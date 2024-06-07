import { hydrate_nodes, hydrate_start, hydrating } from './hydration.js';
import { empty } from './operations.js';
import { create_fragment_from_html } from './reconciler.js';
import { current_effect } from '../runtime.js';
import { TEMPLATE_FRAGMENT, TEMPLATE_USE_IMPORT_NODE } from '../../../constants.js';
import { effect } from '../reactivity/effects.js';
import { is_array } from '../utils.js';

/**
 * @template {import("#client").TemplateNode | import("#client").TemplateNode[]} T
 * @param {T} dom
 * @param {import("#client").Effect} effect
 */
export function push_template_node(
	dom,
	effect = /** @type {import('#client').Effect} */ (current_effect)
) {
	var current_dom = effect.dom;
	if (current_dom === null) {
		effect.dom = dom;
	} else {
		if (!is_array(current_dom)) {
			current_dom = effect.dom = [current_dom];
		}

		if (is_array(dom)) {
			current_dom.push(...dom);
		} else {
			current_dom.push(dom);
		}
	}
	return dom;
}

/**
 * @param {string} content
 * @param {number} flags
 * @returns {() => Node | Node[]}
 */
/*#__NO_SIDE_EFFECTS__*/
export function template(content, flags) {
	var is_fragment = (flags & TEMPLATE_FRAGMENT) !== 0;
	var use_import_node = (flags & TEMPLATE_USE_IMPORT_NODE) !== 0;

	/** @type {Node} */
	var node;

	return () => {
		if (hydrating) {
			push_template_node(is_fragment ? hydrate_nodes : hydrate_start);
			return hydrate_start;
		}

		if (!node) {
			node = create_fragment_from_html(content);
			if (!is_fragment) node = /** @type {Node} */ (node.firstChild);
		}

		var clone = use_import_node ? document.importNode(node, true) : node.cloneNode(true);

		push_template_node(
			is_fragment
				? /** @type {import('#client').TemplateNode[]} */ ([...clone.childNodes])
				: /** @type {import('#client').TemplateNode} */ (clone)
		);

		return clone;
	};
}

/**
 * @param {string} content
 * @param {number} flags
 * @returns {() => Node | Node[]}
 */
/*#__NO_SIDE_EFFECTS__*/
export function template_with_script(content, flags) {
	var first = true;
	var fn = template(content, flags);

	return () => {
		if (hydrating) return fn();

		var node = /** @type {Element | DocumentFragment} */ (fn());

		if (first) {
			first = false;
			run_scripts(node);
		}

		return node;
	};
}

/**
 * @param {string} content
 * @param {number} flags
 * @param {'svg' | 'math'} ns
 * @returns {() => Node | Node[]}
 */
/*#__NO_SIDE_EFFECTS__*/
export function ns_template(content, flags, ns = 'svg') {
	var is_fragment = (flags & TEMPLATE_FRAGMENT) !== 0;
	var fn = template(`<${ns}>${content}</${ns}>`, 0); // we don't need to worry about using importNode for namespaced elements

	/** @type {Element | DocumentFragment} */
	var node;

	return () => {
		if (hydrating) {
			push_template_node(is_fragment ? hydrate_nodes : hydrate_start);
			return hydrate_start;
		}

		if (!node) {
			var wrapper = /** @type {Element} */ (fn());

			if ((flags & TEMPLATE_FRAGMENT) === 0) {
				node = /** @type {Element} */ (wrapper.firstChild);
			} else {
				node = document.createDocumentFragment();
				while (wrapper.firstChild) {
					node.appendChild(wrapper.firstChild);
				}
			}
		}

		var clone = node.cloneNode(true);

		push_template_node(
			is_fragment
				? /** @type {import('#client').TemplateNode[]} */ ([...clone.childNodes])
				: /** @type {import('#client').TemplateNode} */ (clone)
		);

		return clone;
	};
}

/**
 * @param {string} content
 * @param {number} flags
 * @returns {() => Node | Node[]}
 */
/*#__NO_SIDE_EFFECTS__*/
export function svg_template_with_script(content, flags) {
	var first = true;
	var fn = ns_template(content, flags);

	return () => {
		if (hydrating) return fn();

		var node = /** @type {Element | DocumentFragment} */ (fn());

		if (first) {
			first = false;
			run_scripts(node);
		}

		return node;
	};
}

/**
 * @param {string} content
 * @param {number} flags
 * @returns {() => Node | Node[]}
 */
/*#__NO_SIDE_EFFECTS__*/
export function mathml_template(content, flags) {
	return ns_template(content, flags, 'math');
}

/**
 * Creating a document fragment from HTML that contains script tags will not execute
 * the scripts. We need to replace the script tags with new ones so that they are executed.
 * @param {Element | DocumentFragment} node
 */
function run_scripts(node) {
	// scripts were SSR'd, in which case they will run
	if (hydrating) return;

	const scripts =
		/** @type {HTMLElement} */ (node).tagName === 'SCRIPT'
			? [/** @type {HTMLScriptElement} */ (node)]
			: node.querySelectorAll('script');
	for (const script of scripts) {
		var clone = document.createElement('script');
		for (var attribute of script.attributes) {
			clone.setAttribute(attribute.name, attribute.value);
		}

		clone.textContent = script.textContent;
		// If node === script tag, replaceWith will do nothing because there's no parent yet,
		// waiting until that's the case using an effect solves this.
		// Don't do it in other circumstances or we could accidentally execute scripts
		// in an adjacent @html tag that was instantiated in the meantime.
		if (script === node) {
			effect(() => script.replaceWith(clone));
		} else {
			script.replaceWith(clone);
		}
	}
}

/**
 * @param {Text | Comment | Element} anchor
 */
/*#__NO_SIDE_EFFECTS__*/
export function text(anchor) {
	if (!hydrating) return push_template_node(empty());

	var node = hydrate_start;

	if (!node) {
		// if an {expression} is empty during SSR, `hydrate_nodes` will be empty.
		// we need to insert an empty text node
		anchor.before((node = empty()));
	}

	push_template_node(node);
	return node;
}

export function comment() {
	// we're not delegating to `template` here for performance reasons
	if (hydrating) {
		push_template_node(hydrate_nodes);
		return hydrate_start;
	}

	var frag = document.createDocumentFragment();
	var anchor = empty();
	frag.append(anchor);
	push_template_node([anchor]);

	return frag;
}

/**
 * Assign the created (or in hydration mode, traversed) dom elements to the current block
 * and insert the elements into the dom (in client mode).
 * @param {Text | Comment | Element} anchor
 * @param {DocumentFragment | Element} dom
 */
export function append(anchor, dom) {
	if (hydrating) return;
	// We intentionally do not assign the `dom` property of the effect here because it's far too
	// late. If we try, we will capture additional DOM elements that we cannot control the lifecycle
	// for and will inevitably cause memory leaks. See https://github.com/sveltejs/svelte/pull/11832

	anchor.before(/** @type {Node} */ (dom));
}
