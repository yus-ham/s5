/**
 * @typedef BindingProperty
 * @property {string} [event] This is set if the binding corresponds to the property name on the dom element it's bound to
 * 							  and there's an event that notifies of a change to that property
 * @property {boolean} [bidirectional] Set this to `true` if updates are written to the dom property
 * @property {boolean} [omit_in_ssr] Set this to true if the binding should not be included in SSR
 * @property {string[]} [valid_elements] If this is set, the binding is only valid on the given elements
 * @property {string[]} [invalid_elements] If this is set, the binding is invalid on the given elements
 */

/**
 * @type {Record<string, BindingProperty>}
 */
export const binding_properties = {
	// media
	currentTime: {
		valid_elements: ['audio', 'video'],
		omit_in_ssr: true
	},
	duration: {
		valid_elements: ['audio', 'video'],
		event: 'durationchange',
		omit_in_ssr: true
	},
	focused: {},
	paused: {
		valid_elements: ['audio', 'video'],
		omit_in_ssr: true
	},
	buffered: {
		valid_elements: ['audio', 'video'],
		omit_in_ssr: true
	},
	seekable: {
		valid_elements: ['audio', 'video'],
		omit_in_ssr: true
	},
	played: {
		valid_elements: ['audio', 'video'],
		omit_in_ssr: true
	},
	volume: {
		valid_elements: ['audio', 'video'],
		omit_in_ssr: true
	},
	muted: {
		valid_elements: ['audio', 'video'],
		omit_in_ssr: true
	},
	playbackRate: {
		valid_elements: ['audio', 'video'],
		omit_in_ssr: true
	},
	seeking: {
		valid_elements: ['audio', 'video'],
		omit_in_ssr: true
	},
	ended: {
		valid_elements: ['audio', 'video'],
		omit_in_ssr: true
	},
	readyState: {
		valid_elements: ['audio', 'video'],
		omit_in_ssr: true
	},
	// video
	videoHeight: {
		valid_elements: ['video'],
		event: 'resize',
		omit_in_ssr: true
	},
	videoWidth: {
		valid_elements: ['video'],
		event: 'resize',
		omit_in_ssr: true
	},
	// img
	naturalWidth: {
		valid_elements: ['img'],
		event: 'load',
		omit_in_ssr: true
	},
	naturalHeight: {
		valid_elements: ['img'],
		event: 'load',
		omit_in_ssr: true
	},
	// document
	activeElement: {
		valid_elements: ['svelte:document'],
		omit_in_ssr: true
	},
	fullscreenElement: {
		valid_elements: ['svelte:document'],
		event: 'fullscreenchange',
		omit_in_ssr: true
	},
	pointerLockElement: {
		valid_elements: ['svelte:document'],
		event: 'pointerlockchange',
		omit_in_ssr: true
	},
	visibilityState: {
		valid_elements: ['svelte:document'],
		event: 'visibilitychange',
		omit_in_ssr: true
	},
	// window
	innerWidth: {
		valid_elements: ['svelte:window'],
		omit_in_ssr: true
	},
	innerHeight: {
		valid_elements: ['svelte:window'],
		omit_in_ssr: true
	},
	outerWidth: {
		valid_elements: ['svelte:window'],
		omit_in_ssr: true
	},
	outerHeight: {
		valid_elements: ['svelte:window'],
		omit_in_ssr: true
	},
	scrollX: {
		valid_elements: ['svelte:window'],
		omit_in_ssr: true
	},
	scrollY: {
		valid_elements: ['svelte:window'],
		omit_in_ssr: true
	},
	online: {
		valid_elements: ['svelte:window'],
		omit_in_ssr: true
	},
	devicePixelRatio: {
		valid_elements: ['svelte:window'],
		event: 'resize',
		omit_in_ssr: true
	},
	// dimensions
	clientWidth: {
		omit_in_ssr: true,
		invalid_elements: ['svelte:window', 'svelte:document']
	},
	clientHeight: {
		omit_in_ssr: true,
		invalid_elements: ['svelte:window', 'svelte:document']
	},
	offsetWidth: {
		omit_in_ssr: true,
		invalid_elements: ['svelte:window', 'svelte:document']
	},
	offsetHeight: {
		omit_in_ssr: true,
		invalid_elements: ['svelte:window', 'svelte:document']
	},
	contentRect: {
		omit_in_ssr: true,
		invalid_elements: ['svelte:window', 'svelte:document']
	},
	contentBoxSize: {
		omit_in_ssr: true,
		invalid_elements: ['svelte:window', 'svelte:document']
	},
	borderBoxSize: {
		omit_in_ssr: true,
		invalid_elements: ['svelte:window', 'svelte:document']
	},
	devicePixelContentBoxSize: {
		omit_in_ssr: true,
		invalid_elements: ['svelte:window', 'svelte:document']
	},
	// checkbox/radio
	indeterminate: {
		event: 'change',
		bidirectional: true,
		valid_elements: ['input'],
		omit_in_ssr: true // no corresponding attribute
	},
	checked: {
		valid_elements: ['input']
	},
	group: {
		valid_elements: ['input']
	},
	// various
	this: {
		omit_in_ssr: true
	},
	innerText: {
		invalid_elements: ['svelte:window', 'svelte:document']
	},
	innerHTML: {
		invalid_elements: ['svelte:window', 'svelte:document']
	},
	textContent: {
		invalid_elements: ['svelte:window', 'svelte:document']
	},
	open: {
		event: 'toggle',
		bidirectional: true,
		valid_elements: ['details']
	},
	value: {
		valid_elements: ['input', 'textarea', 'select']
	},
	files: {
		valid_elements: ['input'],
		omit_in_ssr: true
	}
};
