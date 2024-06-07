import { flushSync } from 'svelte';
import { test } from '../../test';

export default test({
	get props() {
		return { a: 3, b: 4, c: 5, d: 6 };
	},
	html: `
		<div>Length: 3</div>
		<div>Values: 4,5,1</div>
		<div d="4" e="5" foo="1"></div>
		<button></button><button></button><button></button><button></button>
	`,
	test({ assert, target, window }) {
		const [btn1, btn2, btn3, btn4] = target.querySelectorAll('button');
		const clickEvent = new window.Event('click', { bubbles: true });

		btn1.dispatchEvent(clickEvent);
		flushSync();

		assert.htmlEqual(
			target.innerHTML,
			`
			<div>Length: 3</div>
			<div>Values: 4,5,1</div>
			<div d="4" e="5" foo="1"></div>
			<button></button><button></button><button></button><button></button>
		`
		);

		btn2.dispatchEvent(clickEvent);
		flushSync();

		assert.htmlEqual(
			target.innerHTML,
			`
			<div>Length: 3</div>
			<div>Values: 34,5,1</div>
			<div d="34" e="5" foo="1"></div>
			<button></button><button></button><button></button><button></button>
		`
		);

		btn3.dispatchEvent(clickEvent);
		flushSync();

		assert.htmlEqual(
			target.innerHTML,
			`
			<div>Length: 3</div>
			<div>Values: 34,5,31</div>
			<div d="34" e="5" foo="31"></div>
			<button></button><button></button><button></button><button></button>
		`
		);

		btn4.dispatchEvent(clickEvent);
		flushSync();

		assert.htmlEqual(
			target.innerHTML,
			`
			<div>Length: 4</div>
			<div>Values: 34,5,31,2</div>
			<div d="34" e="5" foo="31" bar="2"></div>
			<button></button><button></button><button></button><button></button>
		`
		);
	}
});
