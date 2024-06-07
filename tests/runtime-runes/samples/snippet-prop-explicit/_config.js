import { flushSync } from 'svelte';
import { test } from '../../test';

export default test({
	html: `
		<p>clicks: 0</p>
		<button>click me</button>
	`,

	test({ assert, target }) {
		const btn = target.querySelector('button');

		btn?.click();
		flushSync();
		assert.htmlEqual(
			target.innerHTML,
			`
				<p>clicks: 1</p>
				<button>click me</button>
			`
		);
	}
});
