import { test } from '../../test';

export default test({
	compileOptions: {
		dev: true
	},

	async test({ assert, warnings }) {
		assert.deepEqual(warnings, [
			'`bind:value={pojo.value}` (main.svelte:50:7) is binding to a non-reactive property',
			'`bind:value={raw.value}` (main.svelte:51:7) is binding to a non-reactive property',
			'`bind:value={pojo.value}` (main.svelte:52:7) is binding to a non-reactive property',
			'`bind:value={raw.value}` (main.svelte:53:7) is binding to a non-reactive property',
			'`bind:this={pojo.value}` (main.svelte:55:6) is binding to a non-reactive property'
		]);
	}
});
