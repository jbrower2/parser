import type { LexerFields, Token } from "@jbrower/lexer";

export type ParserTypes = {
	[key: string]: any;
};

export type ParserRules<L extends LexerFields, T extends ParserTypes> = {
	[K in keyof T]: ParserRule<L, T[K]>;
};

export class ParserRule<L extends LexerFields, O> {
	constructor(
		public readonly name: string,
		private readonly parseInternal: (
			input: readonly Token<L>[],
			start: number,
			stack: readonly string[]
		) => ParseResult<O> | undefined
	) {}

	parse = (
		input: readonly Token<L>[],
		start: number,
		stack: readonly string[]
	): ParseResult<O> | undefined => {
		const stackItem = `${this.name}:${start}`;
		if (stack.includes(stackItem)) {
			throw new Error(
				`Loop detected:\n${stack
					.map((s) => `* ${s}`)
					.join("\n")}\n> ${stackItem}`
			);
		}
		return this.parseInternal(input, start, [...stack, stackItem]);
	};

	withName = (name: string): ParserRule<L, O> =>
		new ParserRule(name, this.parseInternal);
}

export interface ParseResult<O> {
	value: O;
	end: number;
}

function repInternal<L extends LexerFields, O>(
	rule: ParserRule<L, O>,
	sep: ParserRule<L, any> | undefined,
	min: number,
	max: number | undefined
): ParserRule<L, readonly O[]> {
	const subNames = sep ? `${rule.name}, ${sep.name}` : rule.name;
	let name: string;
	if (max === undefined) {
		if (min === 0) {
			name = `star(${subNames})`;
		} else if (min === 1) {
			name = `plus(${subNames})`;
		} else {
			name = `rep(${subNames}, ${min})`;
		}
	} else {
		name = `rep(${subNames}, ${min}, ${max})`;
	}
	return new ParserRule(
		name,
		(
			input: readonly Token<L>[],
			start: number,
			stack: readonly string[]
		): ParseResult<readonly O[]> | undefined => {
			const results = new Array<O>();
			let end = start;

			const firstResult = rule.parse(input, start, stack);
			if (firstResult) {
				results.push(firstResult.value);
				end = firstResult.end;

				while (true) {
					start = end;
					if (sep) {
						const sepResult = sep.parse(input, start, stack);
						if (!sepResult) break;
						start = sepResult.end;
					}

					const result = rule.parse(input, start, stack);
					if (!result) break;
					results.push(result.value);
					end = result.end;
				}
			}

			if (
				results.length < min ||
				(typeof max === "number" && results.length > max)
			) {
				return undefined;
			}

			return { value: results, end };
		}
	);
}

function concatInternal<L extends LexerFields, O>(
	rules: readonly ParserRule<L, O>[]
): ParserRule<L, readonly O[]> {
	return new ParserRule(
		`concat(${rules.map((r) => r.name).join(", ")})`,
		(
			input: readonly Token<L>[],
			start: number,
			stack: readonly string[]
		): ParseResult<any[]> | undefined => {
			const results = new Array<any>();
			let end = start;
			for (const rule of rules) {
				const result = rule.parse(input, end, stack);
				if (!result) return undefined;
				results.push(result.value);
				end = result.end;
			}
			return { value: results, end };
		}
	);
}

export type OptResult<O> =
	| { success: true; value: O }
	| { success: false; value: undefined };

export class ParserUtils<L extends LexerFields, T extends ParserTypes> {
	constructor(private readonly p: Parser<L, T>) {}

	not(rule: ParserRule<L, any>): ParserRule<L, undefined> {
		return new ParserRule(
			`not(${rule.name})`,
			(
				input: readonly Token<L>[],
				start: number,
				stack: readonly string[]
			): ParseResult<undefined> | undefined => {
				const result = rule.parse(input, start, stack);
				return result ? undefined : { value: undefined, end: start };
			}
		);
	}

	or<O>(...options: readonly ParserRule<L, O>[]): ParserRule<L, O> {
		return new ParserRule(
			`or(${options.map((o) => o.name).join(", ")})`,
			(
				input: readonly Token<L>[],
				start: number,
				stack: readonly string[]
			): ParseResult<O> | undefined => {
				for (const option of options) {
					const result = option.parse(input, start, stack);
					if (result) {
						return result;
					}
				}
				return undefined;
			}
		);
	}

	orLongest<O>(...options: readonly ParserRule<L, O>[]): ParserRule<L, O> {
		return new ParserRule(
			`orLongest(${options.map((o) => o.name).join(", ")})`,
			(
				input: readonly Token<L>[],
				start: number,
				stack: readonly string[]
			): ParseResult<O> | undefined => {
				let longest: ParseResult<O> | undefined;
				for (const option of options) {
					const result = option.parse(input, start, stack);
					if (result && (!longest || result.end > longest.end)) {
						longest = result;
					}
				}
				return longest;
			}
		);
	}

	// prettier-ignore
	concat<O1, O2>(
		rule1: ParserRule<L, O1>,
		rule2: ParserRule<L, O2>
	): ParserRule<L, readonly [O1, O2]>;

	// prettier-ignore
	concat<O1, O2, O3>(
		rule1: ParserRule<L, O1>,
		rule2: ParserRule<L, O2>,
		rule3: ParserRule<L, O3>
	): ParserRule<L, readonly [O1, O2, O3]>;

	// prettier-ignore
	concat<O1, O2, O3, O4>(
		rule1: ParserRule<L, O1>,
		rule2: ParserRule<L, O2>,
		rule3: ParserRule<L, O3>,
		rule4: ParserRule<L, O4>
	): ParserRule<L, readonly [O1, O2, O3, O4]>;

	// prettier-ignore
	concat<O1, O2, O3, O4, O5>(
		rule1: ParserRule<L, O1>,
		rule2: ParserRule<L, O2>,
		rule3: ParserRule<L, O3>,
		rule4: ParserRule<L, O4>,
		rule5: ParserRule<L, O5>
	): ParserRule<L, readonly [O1, O2, O3, O4, O5]>;

	// prettier-ignore
	concat<O1, O2, O3, O4, O5, O6>(
		rule1: ParserRule<L, O1>,
		rule2: ParserRule<L, O2>,
		rule3: ParserRule<L, O3>,
		rule4: ParserRule<L, O4>,
		rule5: ParserRule<L, O5>,
		rule6: ParserRule<L, O6>
	): ParserRule<L, readonly [O1, O2, O3, O4, O5, O6]>;

	// prettier-ignore
	concat<O1, O2, O3, O4, O5, O6, O7>(
		rule1: ParserRule<L, O1>,
		rule2: ParserRule<L, O2>,
		rule3: ParserRule<L, O3>,
		rule4: ParserRule<L, O4>,
		rule5: ParserRule<L, O5>,
		rule6: ParserRule<L, O6>,
		rule7: ParserRule<L, O7>
	): ParserRule<L, readonly [O1, O2, O3, O4, O5, O6, O7]>;

	// prettier-ignore
	concat<O1, O2, O3, O4, O5, O6, O7, O8>(
		rule1: ParserRule<L, O1>,
		rule2: ParserRule<L, O2>,
		rule3: ParserRule<L, O3>,
		rule4: ParserRule<L, O4>,
		rule5: ParserRule<L, O5>,
		rule6: ParserRule<L, O6>,
		rule7: ParserRule<L, O7>,
		rule8: ParserRule<L, O8>
	): ParserRule<L, readonly [O1, O2, O3, O4, O5, O6, O7, O8]>;

	// prettier-ignore
	concat<O1, O2, O3, O4, O5, O6, O7, O8, O9>(
		rule1: ParserRule<L, O1>,
		rule2: ParserRule<L, O2>,
		rule3: ParserRule<L, O3>,
		rule4: ParserRule<L, O4>,
		rule5: ParserRule<L, O5>,
		rule6: ParserRule<L, O6>,
		rule7: ParserRule<L, O7>,
		rule8: ParserRule<L, O8>,
		rule9: ParserRule<L, O9>
	): ParserRule<L, readonly [O1, O2, O3, O4, O5, O6, O7, O8, O9]>;

	// prettier-ignore
	concat<O1, O2, O3, O4, O5, O6, O7, O8, O9, O10>(
		rule1: ParserRule<L, O1>,
		rule2: ParserRule<L, O2>,
		rule3: ParserRule<L, O3>,
		rule4: ParserRule<L, O4>,
		rule5: ParserRule<L, O5>,
		rule6: ParserRule<L, O6>,
		rule7: ParserRule<L, O7>,
		rule8: ParserRule<L, O8>,
		rule9: ParserRule<L, O9>,
		rule10: ParserRule<L, O10>
	): ParserRule<L, readonly [O1, O2, O3, O4, O5, O6, O7, O8, O9, O10]>;

	// prettier-ignore
	concat<O1, O2, O3, O4, O5, O6, O7, O8, O9, O10, O11>(
		rule1: ParserRule<L, O1>,
		rule2: ParserRule<L, O2>,
		rule3: ParserRule<L, O3>,
		rule4: ParserRule<L, O4>,
		rule5: ParserRule<L, O5>,
		rule6: ParserRule<L, O6>,
		rule7: ParserRule<L, O7>,
		rule8: ParserRule<L, O8>,
		rule9: ParserRule<L, O9>,
		rule10: ParserRule<L, O10>,
		rule11: ParserRule<L, O11>
	): ParserRule<L, readonly [O1, O2, O3, O4, O5, O6, O7, O8, O9, O10, O11]>;

	// prettier-ignore
	concat<O1, O2, O3, O4, O5, O6, O7, O8, O9, O10, O11, O12>(
		rule1: ParserRule<L, O1>,
		rule2: ParserRule<L, O2>,
		rule3: ParserRule<L, O3>,
		rule4: ParserRule<L, O4>,
		rule5: ParserRule<L, O5>,
		rule6: ParserRule<L, O6>,
		rule7: ParserRule<L, O7>,
		rule8: ParserRule<L, O8>,
		rule9: ParserRule<L, O9>,
		rule10: ParserRule<L, O10>,
		rule11: ParserRule<L, O11>,
		rule12: ParserRule<L, O12>
	): ParserRule<L, readonly [O1, O2, O3, O4, O5, O6, O7, O8, O9, O10, O11, O12]>;

	// prettier-ignore
	concat<O1, O2, O3, O4, O5, O6, O7, O8, O9, O10, O11, O12, O13>(
		rule1: ParserRule<L, O1>,
		rule2: ParserRule<L, O2>,
		rule3: ParserRule<L, O3>,
		rule4: ParserRule<L, O4>,
		rule5: ParserRule<L, O5>,
		rule6: ParserRule<L, O6>,
		rule7: ParserRule<L, O7>,
		rule8: ParserRule<L, O8>,
		rule9: ParserRule<L, O9>,
		rule10: ParserRule<L, O10>,
		rule11: ParserRule<L, O11>,
		rule12: ParserRule<L, O12>,
		rule13: ParserRule<L, O13>
	): ParserRule<L, readonly [O1, O2, O3, O4, O5, O6, O7, O8, O9, O10, O11, O12, O13]>;

	// prettier-ignore
	concat<O1, O2, O3, O4, O5, O6, O7, O8, O9, O10, O11, O12, O13, O14>(
		rule1: ParserRule<L, O1>,
		rule2: ParserRule<L, O2>,
		rule3: ParserRule<L, O3>,
		rule4: ParserRule<L, O4>,
		rule5: ParserRule<L, O5>,
		rule6: ParserRule<L, O6>,
		rule7: ParserRule<L, O7>,
		rule8: ParserRule<L, O8>,
		rule9: ParserRule<L, O9>,
		rule10: ParserRule<L, O10>,
		rule11: ParserRule<L, O11>,
		rule12: ParserRule<L, O12>,
		rule13: ParserRule<L, O13>,
		rule14: ParserRule<L, O14>
	): ParserRule<L, readonly [O1, O2, O3, O4, O5, O6, O7, O8, O9, O10, O11, O12, O13, O14]>;

	// prettier-ignore
	concat<O1, O2, O3, O4, O5, O6, O7, O8, O9, O10, O11, O12, O13, O14, O15>(
		rule1: ParserRule<L, O1>,
		rule2: ParserRule<L, O2>,
		rule3: ParserRule<L, O3>,
		rule4: ParserRule<L, O4>,
		rule5: ParserRule<L, O5>,
		rule6: ParserRule<L, O6>,
		rule7: ParserRule<L, O7>,
		rule8: ParserRule<L, O8>,
		rule9: ParserRule<L, O9>,
		rule10: ParserRule<L, O10>,
		rule11: ParserRule<L, O11>,
		rule12: ParserRule<L, O12>,
		rule13: ParserRule<L, O13>,
		rule14: ParserRule<L, O14>,
		rule15: ParserRule<L, O15>
	): ParserRule<L, readonly [O1, O2, O3, O4, O5, O6, O7, O8, O9, O10, O11, O12, O13, O14, O15]>;

	// prettier-ignore
	concat<O1, O2, O3, O4, O5, O6, O7, O8, O9, O10, O11, O12, O13, O14, O15, O16>(
		rule1: ParserRule<L, O1>,
		rule2: ParserRule<L, O2>,
		rule3: ParserRule<L, O3>,
		rule4: ParserRule<L, O4>,
		rule5: ParserRule<L, O5>,
		rule6: ParserRule<L, O6>,
		rule7: ParserRule<L, O7>,
		rule8: ParserRule<L, O8>,
		rule9: ParserRule<L, O9>,
		rule10: ParserRule<L, O10>,
		rule11: ParserRule<L, O11>,
		rule12: ParserRule<L, O12>,
		rule13: ParserRule<L, O13>,
		rule14: ParserRule<L, O14>,
		rule15: ParserRule<L, O15>,
		rule16: ParserRule<L, O16>
	): ParserRule<L, readonly [O1, O2, O3, O4, O5, O6, O7, O8, O9, O10, O11, O12, O13, O14, O15, O16]>;

	// prettier-ignore
	concat<O1, O2, O3, O4, O5, O6, O7, O8, O9, O10, O11, O12, O13, O14, O15, O16, O17>(
		rule1: ParserRule<L, O1>,
		rule2: ParserRule<L, O2>,
		rule3: ParserRule<L, O3>,
		rule4: ParserRule<L, O4>,
		rule5: ParserRule<L, O5>,
		rule6: ParserRule<L, O6>,
		rule7: ParserRule<L, O7>,
		rule8: ParserRule<L, O8>,
		rule9: ParserRule<L, O9>,
		rule10: ParserRule<L, O10>,
		rule11: ParserRule<L, O11>,
		rule12: ParserRule<L, O12>,
		rule13: ParserRule<L, O13>,
		rule14: ParserRule<L, O14>,
		rule15: ParserRule<L, O15>,
		rule16: ParserRule<L, O16>,
		rule17: ParserRule<L, O17>
	): ParserRule<L, readonly [O1, O2, O3, O4, O5, O6, O7, O8, O9, O10, O11, O12, O13, O14, O15, O16, O17]>;

	// prettier-ignore
	concat<O1, O2, O3, O4, O5, O6, O7, O8, O9, O10, O11, O12, O13, O14, O15, O16, O17, O18>(
		rule1: ParserRule<L, O1>,
		rule2: ParserRule<L, O2>,
		rule3: ParserRule<L, O3>,
		rule4: ParserRule<L, O4>,
		rule5: ParserRule<L, O5>,
		rule6: ParserRule<L, O6>,
		rule7: ParserRule<L, O7>,
		rule8: ParserRule<L, O8>,
		rule9: ParserRule<L, O9>,
		rule10: ParserRule<L, O10>,
		rule11: ParserRule<L, O11>,
		rule12: ParserRule<L, O12>,
		rule13: ParserRule<L, O13>,
		rule14: ParserRule<L, O14>,
		rule15: ParserRule<L, O15>,
		rule16: ParserRule<L, O16>,
		rule17: ParserRule<L, O17>,
		rule18: ParserRule<L, O18>
	): ParserRule<L, readonly [O1, O2, O3, O4, O5, O6, O7, O8, O9, O10, O11, O12, O13, O14, O15, O16, O17, O18]>;

	// prettier-ignore
	concat<O1, O2, O3, O4, O5, O6, O7, O8, O9, O10, O11, O12, O13, O14, O15, O16, O17, O18, O19>(
		rule1: ParserRule<L, O1>,
		rule2: ParserRule<L, O2>,
		rule3: ParserRule<L, O3>,
		rule4: ParserRule<L, O4>,
		rule5: ParserRule<L, O5>,
		rule6: ParserRule<L, O6>,
		rule7: ParserRule<L, O7>,
		rule8: ParserRule<L, O8>,
		rule9: ParserRule<L, O9>,
		rule10: ParserRule<L, O10>,
		rule11: ParserRule<L, O11>,
		rule12: ParserRule<L, O12>,
		rule13: ParserRule<L, O13>,
		rule14: ParserRule<L, O14>,
		rule15: ParserRule<L, O15>,
		rule16: ParserRule<L, O16>,
		rule17: ParserRule<L, O17>,
		rule18: ParserRule<L, O18>,
		rule19: ParserRule<L, O19>
	): ParserRule<L, readonly [O1, O2, O3, O4, O5, O6, O7, O8, O9, O10, O11, O12, O13, O14, O15, O16, O17, O18, O19]>;

	// prettier-ignore
	concat<O1, O2, O3, O4, O5, O6, O7, O8, O9, O10, O11, O12, O13, O14, O15, O16, O17, O18, O19, O20>(
		rule1: ParserRule<L, O1>,
		rule2: ParserRule<L, O2>,
		rule3: ParserRule<L, O3>,
		rule4: ParserRule<L, O4>,
		rule5: ParserRule<L, O5>,
		rule6: ParserRule<L, O6>,
		rule7: ParserRule<L, O7>,
		rule8: ParserRule<L, O8>,
		rule9: ParserRule<L, O9>,
		rule10: ParserRule<L, O10>,
		rule11: ParserRule<L, O11>,
		rule12: ParserRule<L, O12>,
		rule13: ParserRule<L, O13>,
		rule14: ParserRule<L, O14>,
		rule15: ParserRule<L, O15>,
		rule16: ParserRule<L, O16>,
		rule17: ParserRule<L, O17>,
		rule18: ParserRule<L, O18>,
		rule19: ParserRule<L, O19>,
		rule20: ParserRule<L, O20>
	): ParserRule<L, readonly [O1, O2, O3, O4, O5, O6, O7, O8, O9, O10, O11, O12, O13, O14, O15, O16, O17, O18, O19, O20]>;

	concat(
		...rules: readonly ParserRule<L, any>[]
	): ParserRule<L, readonly any[]> {
		return concatInternal(rules);
	}

	first<O>(
		rule: ParserRule<L, O>,
		rule1: ParserRule<L, any>,
		...rest: readonly ParserRule<L, any>[]
	): ParserRule<L, O> {
		const concat = concatInternal([rule, rule1, ...rest]);
		return new ParserRule(
			concat.name.replace("concat", "first"),
			(
				input: readonly Token<L>[],
				start: number,
				stack: readonly string[]
			): ParseResult<O> | undefined => {
				const result = concat.parse(input, start, stack);
				if (!result) return undefined;
				const { value, end } = result;
				return { value: value[0], end };
			}
		);
	}

	// prettier-ignore
	last<O>(
		rule1: ParserRule<L, any>,
		rule2: ParserRule<L, O>
	): ParserRule<L, O>;

	// prettier-ignore
	last<O>(
		rule1: ParserRule<L, any>,
		rule2: ParserRule<L, any>,
		rule3: ParserRule<L, O>
	): ParserRule<L, O>;

	// prettier-ignore
	last<O>(
		rule1: ParserRule<L, any>,
		rule2: ParserRule<L, any>,
		rule3: ParserRule<L, any>,
		rule4: ParserRule<L, O>
	): ParserRule<L, O>;

	// prettier-ignore
	last<O>(
		rule1: ParserRule<L, any>,
		rule2: ParserRule<L, any>,
		rule3: ParserRule<L, any>,
		rule4: ParserRule<L, any>,
		rule5: ParserRule<L, O>
	): ParserRule<L, O>;

	// prettier-ignore
	last<O>(
		rule1: ParserRule<L, any>,
		rule2: ParserRule<L, any>,
		rule3: ParserRule<L, any>,
		rule4: ParserRule<L, any>,
		rule5: ParserRule<L, any>,
		rule6: ParserRule<L, O>
	): ParserRule<L, O>;

	// prettier-ignore
	last<O>(
		rule1: ParserRule<L, any>,
		rule2: ParserRule<L, any>,
		rule3: ParserRule<L, any>,
		rule4: ParserRule<L, any>,
		rule5: ParserRule<L, any>,
		rule6: ParserRule<L, any>,
		rule7: ParserRule<L, O>
	): ParserRule<L, O>;

	// prettier-ignore
	last<O>(
		rule1: ParserRule<L, any>,
		rule2: ParserRule<L, any>,
		rule3: ParserRule<L, any>,
		rule4: ParserRule<L, any>,
		rule5: ParserRule<L, any>,
		rule6: ParserRule<L, any>,
		rule7: ParserRule<L, any>,
		rule8: ParserRule<L, O>
	): ParserRule<L, O>;

	// prettier-ignore
	last<O>(
		rule1: ParserRule<L, any>,
		rule2: ParserRule<L, any>,
		rule3: ParserRule<L, any>,
		rule4: ParserRule<L, any>,
		rule5: ParserRule<L, any>,
		rule6: ParserRule<L, any>,
		rule7: ParserRule<L, any>,
		rule8: ParserRule<L, any>,
		rule9: ParserRule<L, O>
	): ParserRule<L, O>;

	// prettier-ignore
	last<O>(
		rule1: ParserRule<L, any>,
		rule2: ParserRule<L, any>,
		rule3: ParserRule<L, any>,
		rule4: ParserRule<L, any>,
		rule5: ParserRule<L, any>,
		rule6: ParserRule<L, any>,
		rule7: ParserRule<L, any>,
		rule8: ParserRule<L, any>,
		rule9: ParserRule<L, any>,
		rule10: ParserRule<L, O>
	): ParserRule<L, O>;

	// prettier-ignore
	last<O>(
		rule1: ParserRule<L, any>,
		rule2: ParserRule<L, any>,
		rule3: ParserRule<L, any>,
		rule4: ParserRule<L, any>,
		rule5: ParserRule<L, any>,
		rule6: ParserRule<L, any>,
		rule7: ParserRule<L, any>,
		rule8: ParserRule<L, any>,
		rule9: ParserRule<L, any>,
		rule10: ParserRule<L, any>,
		rule11: ParserRule<L, O>
	): ParserRule<L, O>;

	// prettier-ignore
	last<O>(
		rule1: ParserRule<L, any>,
		rule2: ParserRule<L, any>,
		rule3: ParserRule<L, any>,
		rule4: ParserRule<L, any>,
		rule5: ParserRule<L, any>,
		rule6: ParserRule<L, any>,
		rule7: ParserRule<L, any>,
		rule8: ParserRule<L, any>,
		rule9: ParserRule<L, any>,
		rule10: ParserRule<L, any>,
		rule11: ParserRule<L, any>,
		rule12: ParserRule<L, O>
	): ParserRule<L, O>;

	// prettier-ignore
	last<O>(
		rule1: ParserRule<L, any>,
		rule2: ParserRule<L, any>,
		rule3: ParserRule<L, any>,
		rule4: ParserRule<L, any>,
		rule5: ParserRule<L, any>,
		rule6: ParserRule<L, any>,
		rule7: ParserRule<L, any>,
		rule8: ParserRule<L, any>,
		rule9: ParserRule<L, any>,
		rule10: ParserRule<L, any>,
		rule11: ParserRule<L, any>,
		rule12: ParserRule<L, any>,
		rule13: ParserRule<L, O>
	): ParserRule<L, O>;

	// prettier-ignore
	last<O>(
		rule1: ParserRule<L, any>,
		rule2: ParserRule<L, any>,
		rule3: ParserRule<L, any>,
		rule4: ParserRule<L, any>,
		rule5: ParserRule<L, any>,
		rule6: ParserRule<L, any>,
		rule7: ParserRule<L, any>,
		rule8: ParserRule<L, any>,
		rule9: ParserRule<L, any>,
		rule10: ParserRule<L, any>,
		rule11: ParserRule<L, any>,
		rule12: ParserRule<L, any>,
		rule13: ParserRule<L, any>,
		rule14: ParserRule<L, O>
	): ParserRule<L, O>;

	// prettier-ignore
	last<O>(
		rule1: ParserRule<L, any>,
		rule2: ParserRule<L, any>,
		rule3: ParserRule<L, any>,
		rule4: ParserRule<L, any>,
		rule5: ParserRule<L, any>,
		rule6: ParserRule<L, any>,
		rule7: ParserRule<L, any>,
		rule8: ParserRule<L, any>,
		rule9: ParserRule<L, any>,
		rule10: ParserRule<L, any>,
		rule11: ParserRule<L, any>,
		rule12: ParserRule<L, any>,
		rule13: ParserRule<L, any>,
		rule14: ParserRule<L, any>,
		rule15: ParserRule<L, O>
	): ParserRule<L, O>;

	// prettier-ignore
	last<O>(
		rule1: ParserRule<L, any>,
		rule2: ParserRule<L, any>,
		rule3: ParserRule<L, any>,
		rule4: ParserRule<L, any>,
		rule5: ParserRule<L, any>,
		rule6: ParserRule<L, any>,
		rule7: ParserRule<L, any>,
		rule8: ParserRule<L, any>,
		rule9: ParserRule<L, any>,
		rule10: ParserRule<L, any>,
		rule11: ParserRule<L, any>,
		rule12: ParserRule<L, any>,
		rule13: ParserRule<L, any>,
		rule14: ParserRule<L, any>,
		rule15: ParserRule<L, any>,
		rule16: ParserRule<L, O>
	): ParserRule<L, O>;

	// prettier-ignore
	last<O>(
		rule1: ParserRule<L, any>,
		rule2: ParserRule<L, any>,
		rule3: ParserRule<L, any>,
		rule4: ParserRule<L, any>,
		rule5: ParserRule<L, any>,
		rule6: ParserRule<L, any>,
		rule7: ParserRule<L, any>,
		rule8: ParserRule<L, any>,
		rule9: ParserRule<L, any>,
		rule10: ParserRule<L, any>,
		rule11: ParserRule<L, any>,
		rule12: ParserRule<L, any>,
		rule13: ParserRule<L, any>,
		rule14: ParserRule<L, any>,
		rule15: ParserRule<L, any>,
		rule16: ParserRule<L, any>,
		rule17: ParserRule<L, O>
	): ParserRule<L, O>;

	// prettier-ignore
	last<O>(
		rule1: ParserRule<L, any>,
		rule2: ParserRule<L, any>,
		rule3: ParserRule<L, any>,
		rule4: ParserRule<L, any>,
		rule5: ParserRule<L, any>,
		rule6: ParserRule<L, any>,
		rule7: ParserRule<L, any>,
		rule8: ParserRule<L, any>,
		rule9: ParserRule<L, any>,
		rule10: ParserRule<L, any>,
		rule11: ParserRule<L, any>,
		rule12: ParserRule<L, any>,
		rule13: ParserRule<L, any>,
		rule14: ParserRule<L, any>,
		rule15: ParserRule<L, any>,
		rule16: ParserRule<L, any>,
		rule17: ParserRule<L, any>,
		rule18: ParserRule<L, O>
	): ParserRule<L, O>;

	// prettier-ignore
	last<O>(
		rule1: ParserRule<L, any>,
		rule2: ParserRule<L, any>,
		rule3: ParserRule<L, any>,
		rule4: ParserRule<L, any>,
		rule5: ParserRule<L, any>,
		rule6: ParserRule<L, any>,
		rule7: ParserRule<L, any>,
		rule8: ParserRule<L, any>,
		rule9: ParserRule<L, any>,
		rule10: ParserRule<L, any>,
		rule11: ParserRule<L, any>,
		rule12: ParserRule<L, any>,
		rule13: ParserRule<L, any>,
		rule14: ParserRule<L, any>,
		rule15: ParserRule<L, any>,
		rule16: ParserRule<L, any>,
		rule17: ParserRule<L, any>,
		rule18: ParserRule<L, any>,
		rule19: ParserRule<L, O>
	): ParserRule<L, O>;

	// prettier-ignore
	last<O>(
		rule1: ParserRule<L, any>,
		rule2: ParserRule<L, any>,
		rule3: ParserRule<L, any>,
		rule4: ParserRule<L, any>,
		rule5: ParserRule<L, any>,
		rule6: ParserRule<L, any>,
		rule7: ParserRule<L, any>,
		rule8: ParserRule<L, any>,
		rule9: ParserRule<L, any>,
		rule10: ParserRule<L, any>,
		rule11: ParserRule<L, any>,
		rule12: ParserRule<L, any>,
		rule13: ParserRule<L, any>,
		rule14: ParserRule<L, any>,
		rule15: ParserRule<L, any>,
		rule16: ParserRule<L, any>,
		rule17: ParserRule<L, any>,
		rule18: ParserRule<L, any>,
		rule19: ParserRule<L, any>,
		rule20: ParserRule<L, O>
	): ParserRule<L, O>;

	last(...rules: readonly ParserRule<L, any>[]): ParserRule<L, any> {
		const concat = concatInternal(rules);
		return new ParserRule(
			concat.name.replace("concat", "last"),
			(
				input: readonly Token<L>[],
				start: number,
				stack: readonly string[]
			): ParseResult<any> | undefined => {
				const result = concat.parse(input, start, stack);
				if (!result) return undefined;
				const { value, end } = result;
				return { value: value[value.length - 1], end };
			}
		);
	}

	map<I, O>(rule: ParserRule<L, I>, f: (input: I) => O): ParserRule<L, O> {
		return new ParserRule(
			`map(${rule.name}, [function])`,
			(
				input: readonly Token<L>[],
				start: number,
				stack: readonly string[]
			): ParseResult<O> | undefined => {
				const result = rule.parse(input, start, stack);
				return result && { value: f(result.value), end: result.end };
			}
		);
	}

	filter<O>(rule: ParserRule<L, O>, f: (input: O) => any): ParserRule<L, O> {
		return new ParserRule(
			`filter(${rule.name}, [function])`,
			(
				input: readonly Token<L>[],
				start: number,
				stack: readonly string[]
			): ParseResult<O> | undefined => {
				const result = rule.parse(input, start, stack);
				return result && f(result.value) ? result : undefined;
			}
		);
	}

	filterMap<I, O extends I>(
		rule: ParserRule<L, I>,
		f: (input: I) => input is O
	): ParserRule<L, O> {
		return new ParserRule(
			`filterMap(${rule.name}, [function])`,
			(
				input: readonly Token<L>[],
				start: number,
				stack: readonly string[]
			): ParseResult<O> | undefined => {
				const result = rule.parse(input, start, stack);
				return result && f(result.value)
					? (result as ParseResult<O>)
					: undefined;
			}
		);
	}

	opt<O>(rule: ParserRule<L, O>): ParserRule<L, OptResult<O>> {
		return new ParserRule(
			`opt(${rule.name})`,
			(
				input: readonly Token<L>[],
				start: number,
				stack: readonly string[]
			): ParseResult<OptResult<O>> => {
				const result = rule.parse(input, start, stack);
				if (!result) {
					return { value: { success: false, value: undefined }, end: start };
				}
				const { value, end } = result;
				return { value: { success: true, value }, end };
			}
		);
	}

	star<O>(rule: ParserRule<L, O>): ParserRule<L, readonly O[]>;
	star<O>(
		rule: ParserRule<L, O>,
		sep: ParserRule<L, any>
	): ParserRule<L, readonly O[]>;
	star<O>(
		rule: ParserRule<L, O>,
		sep?: ParserRule<L, any>
	): ParserRule<L, readonly O[]> {
		return repInternal<L, O>(rule, sep, 0, undefined);
	}

	plus<O>(rule: ParserRule<L, O>): ParserRule<L, readonly O[]>;
	plus<O>(
		rule: ParserRule<L, O>,
		sep: ParserRule<L, any>
	): ParserRule<L, readonly O[]>;
	plus<O>(
		rule: ParserRule<L, O>,
		sep?: ParserRule<L, any>
	): ParserRule<L, readonly O[]> {
		return repInternal<L, O>(rule, sep, 1, undefined);
	}

	rep<O>(rule: ParserRule<L, O>, min: number): ParserRule<L, readonly O[]>;
	rep<O>(
		rule: ParserRule<L, O>,
		min: number,
		max: number
	): ParserRule<L, readonly O[]>;
	rep<O>(
		rule: ParserRule<L, O>,
		sep: ParserRule<L, any>,
		min: number
	): ParserRule<L, readonly O[]>;
	rep<O>(
		rule: ParserRule<L, O>,
		sep: ParserRule<L, any>,
		min: number,
		max: number
	): ParserRule<L, readonly O[]>;
	rep<O>(
		p1: ParserRule<L, O>,
		p2: ParserRule<L, any> | number,
		p3?: number,
		p4?: number
	): ParserRule<L, readonly O[]> {
		if (typeof p2 === "number") {
			if (typeof p3 === "number") {
				return repInternal<L, O>(p1, undefined, p2, p3);
			}
			return repInternal<L, O>(p1, undefined, p2, undefined);
		}
		if (typeof p3 !== "number") {
			throw new Error("Expected number");
		}
		if (typeof p4 === "number") {
			return repInternal<L, O>(p1, p2, p3, p4);
		}
		return repInternal<L, O>(p1, p2, p3, undefined);
	}

	token<K extends keyof L>(k: K): ParserRule<L, L[K]> {
		return new ParserRule(
			`token(${k})`,
			(
				input: readonly Token<L>[],
				start: number
			): ParseResult<L[K]> | undefined => {
				if (start >= input.length) {
					return undefined;
				}
				const token = input[start];
				return token.key === k
					? { value: token.data as L[K], end: start + 1 }
					: undefined;
			}
		);
	}

	sub = <K extends keyof T>(k: K): ParserRule<L, T[K]> =>
		new ParserRule(
			`sub(${k})`,
			(
				input: readonly Token<L>[],
				start: number,
				stack: readonly string[]
			): ParseResult<T[K]> | undefined => {
				return (this.p.rules[k] as ParserRule<L, T[K]>).parse(
					input,
					start,
					stack
				);
			}
		);
}

export class Parser<L extends LexerFields, T extends ParserTypes> {
	readonly rules: ParserRules<L, T>;

	constructor(
		private readonly roots: readonly (keyof T)[],
		getRules: (utils: ParserUtils<L, T>) => ParserRules<L, T>
	) {
		this.rules = getRules(new ParserUtils(this));
		for (const key in this.rules) {
			this.rules[key] = this.rules[key].withName(key);
		}
	}

	parse = (input: readonly Token<L>[]): unknown => {
		let best: ParseResult<unknown> | undefined;
		for (const root of this.roots) {
			const result = this.rules[root].parse(input, 0, []);
			if (result && (!best || result.end > best.end)) {
				best = result;
			}
		}
		if (!best) {
			throw new Error("Failed to parse");
		}
		const { value, end } = best;
		if (end < input.length) {
			throw new Error(
				`Not all tokens were consumed: ${JSON.stringify(input[end])}`
			);
		}
		return value;
	};
}
