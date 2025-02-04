/** @import { Parser } from '../index.js' */
import element from './element.js';
import tag from './tag.js';
import text from './text.js';

/** @param {Parser} parser */
export default function fragment(parser) {
	const fragment = parser.plugin.state(parser)

	if (fragment) {
		return fragment;
	}

	if (parser.match('<')) {
		return element;
	}

	if (parser.match('{')) {
		return tag;
	}

	return text;
}
