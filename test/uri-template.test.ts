import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    parseUriTemplate,
    expandUriTemplate,
    isValidUriTemplate,
    getTemplateVariables,
    compileUriTemplate,
} from '../src/uri-template.js';

// RFC 6570 §1.2: Level 1-4 test variables from the specification
const level1Vars = {
    var: 'value',
    hello: 'Hello World!',
};

const level2Vars = {
    ...level1Vars,
    path: '/foo/bar',
};

const level3Vars = {
    ...level2Vars,
    empty: '',
    x: '1024',
    y: '768',
};

const level4Vars = {
    ...level3Vars,
    list: ['red', 'green', 'blue'],
    keys: { semi: ';', dot: '.', comma: ',' },
};

// RFC 6570 §3.2: Additional test variables from the spec
const specVars = {
    count: ['one', 'two', 'three'],
    dom: ['example', 'com'],
    dub: 'me/too',
    hello: 'Hello World!',
    half: '50%',
    var: 'value',
    who: 'fred',
    base: 'http://example.com/home/',
    path: '/foo/bar',
    list: ['red', 'green', 'blue'],
    keys: { semi: ';', dot: '.', comma: ',' },
    v: '6',
    x: '1024',
    y: '768',
    empty: '',
    empty_keys: {},
    undef: undefined,
};

// RFC 6570 §3.2.2: Simple String Expansion (Level 1)
describe('RFC 6570 §3.2.2: Simple String Expansion', () => {
    it('expands {var} to value', () => {
        assert.equal(expandUriTemplate('{var}', level1Vars), 'value');
    });

    it('percent-encodes reserved characters in {hello}', () => {
        assert.equal(expandUriTemplate('{hello}', level1Vars), 'Hello%20World%21');
    });

    it('returns empty string for undefined variable', () => {
        assert.equal(expandUriTemplate('{undef}', specVars), '');
    });

    it('handles empty string value', () => {
        assert.equal(expandUriTemplate('{empty}', level3Vars), '');
    });

    // RFC 6570 §3.2.2: Multiple variables
    it('expands multiple variables with comma separator', () => {
        assert.equal(expandUriTemplate('{x,y}', level3Vars), '1024,768');
    });

    it('expands mixed defined and undefined variables', () => {
        assert.equal(expandUriTemplate('{x,undef,y}', specVars), '1024,768');
    });

    // RFC 6570 §2.4.1: Prefix modifier
    it('applies prefix modifier {var:3}', () => {
        assert.equal(expandUriTemplate('{var:3}', level4Vars), 'val');
    });

    it('handles prefix larger than value length {var:30}', () => {
        assert.equal(expandUriTemplate('{var:30}', level4Vars), 'value');
    });

    // RFC 6570 §2.4.2: Explode modifier for lists
    it('expands list without explode as comma-separated', () => {
        assert.equal(expandUriTemplate('{list}', level4Vars), 'red,green,blue');
    });

    it('expands list with explode {list*}', () => {
        assert.equal(expandUriTemplate('{list*}', level4Vars), 'red,green,blue');
    });

    // RFC 6570 §2.4.2: Explode modifier for associative arrays
    it('expands keys without explode', () => {
        assert.equal(expandUriTemplate('{keys}', level4Vars), 'semi,%3B,dot,.,comma,%2C');
    });

    it('expands keys with explode {keys*}', () => {
        assert.equal(expandUriTemplate('{keys*}', level4Vars), 'semi=%3B,dot=.,comma=%2C');
    });
});

// RFC 6570 §3.2.3: Reserved Expansion (Level 2)
describe('RFC 6570 §3.2.3: Reserved Expansion {+var}', () => {
    it('preserves reserved characters in value', () => {
        assert.equal(expandUriTemplate('{+path}', level2Vars), '/foo/bar');
    });

    it('encodes non-unreserved but preserves reserved in {+hello}', () => {
        assert.equal(expandUriTemplate('{+hello}', level1Vars), 'Hello%20World!');
    });

    it('expands {+var}', () => {
        assert.equal(expandUriTemplate('{+var}', level1Vars), 'value');
    });

    it('handles path with following literal', () => {
        assert.equal(expandUriTemplate('{+path}/here', level2Vars), '/foo/bar/here');
    });

    it('handles path in query context', () => {
        assert.equal(expandUriTemplate('here?ref={+path}', level2Vars), 'here?ref=/foo/bar');
    });

    // RFC 6570 §3.2.3: Multiple variables
    it('expands multiple variables {+x,hello,y}', () => {
        assert.equal(expandUriTemplate('{+x,hello,y}', level3Vars), '1024,Hello%20World!,768');
    });

    // RFC 6570 §3.2.3: With prefix modifier
    it('applies prefix to reserved expansion {+path:6}', () => {
        assert.equal(expandUriTemplate('{+path:6}/here', level4Vars), '/foo/b/here');
    });

    // RFC 6570 §3.2.3: With lists
    it('expands list with reserved {+list}', () => {
        assert.equal(expandUriTemplate('{+list}', level4Vars), 'red,green,blue');
    });

    it('expands list with reserved and explode {+list*}', () => {
        assert.equal(expandUriTemplate('{+list*}', level4Vars), 'red,green,blue');
    });

    it('expands keys with reserved {+keys}', () => {
        assert.equal(expandUriTemplate('{+keys}', level4Vars), 'semi,;,dot,.,comma,,');
    });

    it('expands keys with reserved and explode {+keys*}', () => {
        assert.equal(expandUriTemplate('{+keys*}', level4Vars), 'semi=;,dot=.,comma=,');
    });
});

// RFC 6570 §3.2.4: Fragment Expansion (Level 2)
describe('RFC 6570 §3.2.4: Fragment Expansion {#var}', () => {
    it('prefixes with # {#var}', () => {
        assert.equal(expandUriTemplate('X{#var}', level1Vars), 'X#value');
    });

    it('preserves reserved characters {#hello}', () => {
        assert.equal(expandUriTemplate('X{#hello}', level1Vars), 'X#Hello%20World!');
    });

    // RFC 6570 §3.2.4: Multiple variables
    it('expands multiple variables {#x,hello,y}', () => {
        assert.equal(expandUriTemplate('{#x,hello,y}', level3Vars), '#1024,Hello%20World!,768');
    });

    // RFC 6570 §3.2.4: With prefix modifier
    it('applies prefix {#path:6}', () => {
        assert.equal(expandUriTemplate('{#path:6}/here', level4Vars), '#/foo/b/here');
    });

    // RFC 6570 §3.2.4: With lists
    it('expands list {#list}', () => {
        assert.equal(expandUriTemplate('{#list}', level4Vars), '#red,green,blue');
    });

    it('expands list with explode {#list*}', () => {
        assert.equal(expandUriTemplate('{#list*}', level4Vars), '#red,green,blue');
    });

    it('expands keys {#keys}', () => {
        assert.equal(expandUriTemplate('{#keys}', level4Vars), '#semi,;,dot,.,comma,,');
    });

    it('expands keys with explode {#keys*}', () => {
        assert.equal(expandUriTemplate('{#keys*}', level4Vars), '#semi=;,dot=.,comma=,');
    });
});

// RFC 6570 §3.2.5: Label Expansion with Dot-Prefix (Level 3)
describe('RFC 6570 §3.2.5: Label Expansion {.var}', () => {
    it('prefixes with dot {.var}', () => {
        assert.equal(expandUriTemplate('X{.var}', level1Vars), 'X.value');
    });

    it('separates multiple variables with dots {.x,y}', () => {
        assert.equal(expandUriTemplate('X{.x,y}', level3Vars), 'X.1024.768');
    });

    // RFC 6570 §3.2.5: With prefix modifier
    it('applies prefix {.var:3}', () => {
        assert.equal(expandUriTemplate('X{.var:3}', level4Vars), 'X.val');
    });

    // RFC 6570 §3.2.5: With lists
    it('expands list {.list}', () => {
        assert.equal(expandUriTemplate('X{.list}', level4Vars), 'X.red,green,blue');
    });

    it('expands list with explode {.list*}', () => {
        assert.equal(expandUriTemplate('X{.list*}', level4Vars), 'X.red.green.blue');
    });

    it('expands keys {.keys}', () => {
        assert.equal(expandUriTemplate('X{.keys}', level4Vars), 'X.semi,%3B,dot,.,comma,%2C');
    });

    it('expands keys with explode {.keys*}', () => {
        assert.equal(expandUriTemplate('X{.keys*}', level4Vars), 'X.semi=%3B.dot=..comma=%2C');
    });
});

// RFC 6570 §3.2.6: Path Segment Expansion (Level 3)
describe('RFC 6570 §3.2.6: Path Segment Expansion {/var}', () => {
    it('prefixes with slash {/var}', () => {
        assert.equal(expandUriTemplate('{/var}', level1Vars), '/value');
    });

    it('separates multiple variables with slashes {/var,x}', () => {
        assert.equal(expandUriTemplate('{/var,x}/here', level3Vars), '/value/1024/here');
    });

    // RFC 6570 §3.2.6: With prefix modifier
    it('applies prefix {/var:1,var}', () => {
        assert.equal(expandUriTemplate('{/var:1,var}', level4Vars), '/v/value');
    });

    // RFC 6570 §3.2.6: With lists
    it('expands list {/list}', () => {
        assert.equal(expandUriTemplate('{/list}', level4Vars), '/red,green,blue');
    });

    it('expands list with explode {/list*}', () => {
        assert.equal(expandUriTemplate('{/list*}', level4Vars), '/red/green/blue');
    });

    it('expands list with explode and prefix {/list*,path:4}', () => {
        assert.equal(expandUriTemplate('{/list*,path:4}', level4Vars), '/red/green/blue/%2Ffoo');
    });

    it('expands keys {/keys}', () => {
        assert.equal(expandUriTemplate('{/keys}', level4Vars), '/semi,%3B,dot,.,comma,%2C');
    });

    it('expands keys with explode {/keys*}', () => {
        assert.equal(expandUriTemplate('{/keys*}', level4Vars), '/semi=%3B/dot=./comma=%2C');
    });
});

// RFC 6570 §3.2.7: Path-Style Parameter Expansion (Level 3)
describe('RFC 6570 §3.2.7: Path-Style Parameter Expansion {;var}', () => {
    it('uses name=value format {;x,y}', () => {
        assert.equal(expandUriTemplate('{;x,y}', level3Vars), ';x=1024;y=768');
    });

    it('omits = for empty values {;x,y,empty}', () => {
        assert.equal(expandUriTemplate('{;x,y,empty}', level3Vars), ';x=1024;y=768;empty');
    });

    // RFC 6570 §3.2.7: With prefix modifier
    it('applies prefix {;hello:5}', () => {
        assert.equal(expandUriTemplate('{;hello:5}', level4Vars), ';hello=Hello');
    });

    // RFC 6570 §3.2.7: With lists
    it('expands list {;list}', () => {
        assert.equal(expandUriTemplate('{;list}', level4Vars), ';list=red,green,blue');
    });

    it('expands list with explode {;list*}', () => {
        assert.equal(expandUriTemplate('{;list*}', level4Vars), ';list=red;list=green;list=blue');
    });

    it('expands keys {;keys}', () => {
        assert.equal(expandUriTemplate('{;keys}', level4Vars), ';keys=semi,%3B,dot,.,comma,%2C');
    });

    it('expands keys with explode {;keys*}', () => {
        assert.equal(expandUriTemplate('{;keys*}', level4Vars), ';semi=%3B;dot=.;comma=%2C');
    });
});

// RFC 6570 §3.2.8: Form-Style Query Expansion (Level 3)
describe('RFC 6570 §3.2.8: Form-Style Query Expansion {?var}', () => {
    it('creates query string {?x,y}', () => {
        assert.equal(expandUriTemplate('{?x,y}', level3Vars), '?x=1024&y=768');
    });

    it('uses = for empty values {?x,y,empty}', () => {
        assert.equal(expandUriTemplate('{?x,y,empty}', level3Vars), '?x=1024&y=768&empty=');
    });

    // RFC 6570 §3.2.8: With prefix modifier
    it('applies prefix {?var:3}', () => {
        assert.equal(expandUriTemplate('{?var:3}', level4Vars), '?var=val');
    });

    // RFC 6570 §3.2.8: With lists
    it('expands list {?list}', () => {
        assert.equal(expandUriTemplate('{?list}', level4Vars), '?list=red,green,blue');
    });

    it('expands list with explode {?list*}', () => {
        assert.equal(expandUriTemplate('{?list*}', level4Vars), '?list=red&list=green&list=blue');
    });

    it('expands keys {?keys}', () => {
        assert.equal(expandUriTemplate('{?keys}', level4Vars), '?keys=semi,%3B,dot,.,comma,%2C');
    });

    it('expands keys with explode {?keys*}', () => {
        assert.equal(expandUriTemplate('{?keys*}', level4Vars), '?semi=%3B&dot=.&comma=%2C');
    });
});

// RFC 6570 §3.2.9: Form-Style Query Continuation (Level 3)
describe('RFC 6570 §3.2.9: Form-Style Query Continuation {&var}', () => {
    it('continues query string {&x,y}', () => {
        assert.equal(expandUriTemplate('?fixed=yes{&x}', level3Vars), '?fixed=yes&x=1024');
    });

    it('uses = for empty values {&x,y,empty}', () => {
        assert.equal(expandUriTemplate('{&x,y,empty}', level3Vars), '&x=1024&y=768&empty=');
    });

    // RFC 6570 §3.2.9: With prefix modifier
    it('applies prefix {&var:3}', () => {
        assert.equal(expandUriTemplate('{&var:3}', level4Vars), '&var=val');
    });

    // RFC 6570 §3.2.9: With lists
    it('expands list {&list}', () => {
        assert.equal(expandUriTemplate('{&list}', level4Vars), '&list=red,green,blue');
    });

    it('expands list with explode {&list*}', () => {
        assert.equal(expandUriTemplate('{&list*}', level4Vars), '&list=red&list=green&list=blue');
    });

    it('expands keys {&keys}', () => {
        assert.equal(expandUriTemplate('{&keys}', level4Vars), '&keys=semi,%3B,dot,.,comma,%2C');
    });

    it('expands keys with explode {&keys*}', () => {
        assert.equal(expandUriTemplate('{&keys*}', level4Vars), '&semi=%3B&dot=.&comma=%2C');
    });
});

// RFC 6570 §3.2.1: Undefined vs empty string handling
describe('RFC 6570 §3.2.1: Undefined vs Empty String', () => {
    it('undefined produces no output', () => {
        assert.equal(expandUriTemplate('{undef}', specVars), '');
    });

    it('empty string produces output', () => {
        assert.equal(expandUriTemplate('{empty}', specVars), '');
    });

    it('undefined in named expansion produces nothing', () => {
        assert.equal(expandUriTemplate('{?undef}', specVars), '');
    });

    it('empty string in named expansion produces name=', () => {
        assert.equal(expandUriTemplate('{?empty}', specVars), '?empty=');
    });

    it('empty list is undefined', () => {
        assert.equal(expandUriTemplate('{?empty_keys}', specVars), '');
    });

    it('all undefined variables produces empty string', () => {
        assert.equal(expandUriTemplate('{undef,undef}', specVars), '');
    });

    it('mixed defined and undefined skips undefined', () => {
        assert.equal(expandUriTemplate('{var,undef}', specVars), 'value');
    });
});

// RFC 6570 §2: Template validation
describe('RFC 6570 §2: Template Validation', () => {
    it('validates simple template', () => {
        assert.equal(isValidUriTemplate('http://example.com/{var}'), true);
    });

    it('validates template with multiple expressions', () => {
        assert.equal(isValidUriTemplate('{x,y}'), true);
    });

    it('validates template with all operators', () => {
        assert.equal(isValidUriTemplate('{var}{+var}{#var}{.var}{/var}{;var}{?var}{&var}'), true);
    });

    it('rejects unclosed expression', () => {
        assert.equal(isValidUriTemplate('{var'), false);
    });

    it('rejects unmatched closing brace', () => {
        assert.equal(isValidUriTemplate('var}'), false);
    });

    it('rejects empty expression', () => {
        assert.equal(isValidUriTemplate('{}'), false);
    });

    it('rejects invalid variable name', () => {
        assert.equal(isValidUriTemplate('{var!}'), false);
    });

    it('rejects reserved operators', () => {
        assert.equal(isValidUriTemplate('{=var}'), false);
        assert.equal(isValidUriTemplate('{|var}'), false);
    });

    // RFC 6570 §2.4.1: Prefix validation
    it('rejects prefix of 0', () => {
        assert.equal(isValidUriTemplate('{var:0}'), false);
    });

    it('rejects prefix > 9999', () => {
        assert.equal(isValidUriTemplate('{var:10000}'), false);
    });

    it('accepts valid prefix range 1-9999', () => {
        assert.equal(isValidUriTemplate('{var:1}'), true);
        assert.equal(isValidUriTemplate('{var:9999}'), true);
    });

    // RFC 6570 §2.4: Cannot have both prefix and explode
    it('rejects combined prefix and explode', () => {
        assert.equal(isValidUriTemplate('{var:3*}'), false);
    });

    // RFC 6570 §2.3: Variable name validation
    it('accepts variable names with dots', () => {
        assert.equal(isValidUriTemplate('{foo.bar}'), true);
    });

    it('{.foo} is a valid label expansion, not variable .foo', () => {
        // {.foo} is operator '.' with variable 'foo', which is valid
        assert.equal(isValidUriTemplate('{.foo}'), true);
        // But a literal dot in a variable name in non-operator position would be invalid
        // There's no way to write a variable starting with '.' as it conflicts with operator
    });

    it('rejects variable names ending with dot', () => {
        assert.equal(isValidUriTemplate('{foo.}'), false);
    });

    it('accepts pct-encoded in variable names', () => {
        assert.equal(isValidUriTemplate('{foo%20bar}'), true);
    });
});

// RFC 6570 §2.3: Variable extraction
describe('RFC 6570 §2.3: Variable Extraction', () => {
    it('extracts variables from simple template', () => {
        const vars = getTemplateVariables('{var}');
        assert.deepEqual(vars, ['var']);
    });

    it('extracts multiple variables', () => {
        const vars = getTemplateVariables('{x,y,z}');
        assert.deepEqual(vars, ['x', 'y', 'z']);
    });

    it('extracts from multiple expressions', () => {
        const vars = getTemplateVariables('{x}{y}{z}');
        assert.deepEqual(vars, ['x', 'y', 'z']);
    });

    it('deduplicates repeated variables', () => {
        const vars = getTemplateVariables('{x}{x,y}{y}');
        assert.deepEqual(vars, ['x', 'y']);
    });

    it('strips modifiers from variable names', () => {
        const vars = getTemplateVariables('{var:3}{list*}');
        assert.deepEqual(vars, ['var', 'list']);
    });

    it('returns empty array for invalid template', () => {
        const vars = getTemplateVariables('{unclosed');
        assert.deepEqual(vars, []);
    });
});

// Compile and reuse
describe('compileUriTemplate', () => {
    it('returns null for invalid template', () => {
        const compiled = compileUriTemplate('{unclosed');
        assert.equal(compiled, null);
    });

    it('compiles and expands correctly', () => {
        const compiled = compileUriTemplate('http://example.com/{var}');
        assert.notEqual(compiled, null);
        assert.equal(compiled!.expand({ var: 'value' }), 'http://example.com/value');
    });

    it('provides variable list', () => {
        const compiled = compileUriTemplate('{x,y,z}');
        assert.deepEqual(compiled!.variables, ['x', 'y', 'z']);
    });

    it('allows efficient repeated expansion', () => {
        const compiled = compileUriTemplate('/users/{id}');
        assert.equal(compiled!.expand({ id: '1' }), '/users/1');
        assert.equal(compiled!.expand({ id: '2' }), '/users/2');
        assert.equal(compiled!.expand({ id: '3' }), '/users/3');
    });
});

// Parse template structure
describe('parseUriTemplate', () => {
    it('returns null for invalid template', () => {
        assert.equal(parseUriTemplate('{unclosed'), null);
    });

    it('parses simple template', () => {
        const parsed = parseUriTemplate('http://example.com/{var}');
        assert.notEqual(parsed, null);
        assert.equal(parsed!.parts.length, 2);
        assert.equal(parsed!.parts[0], 'http://example.com/');
        assert.deepEqual(parsed!.variables, ['var']);
    });

    it('parses expression with operator', () => {
        const parsed = parseUriTemplate('{+path}');
        assert.notEqual(parsed, null);
        const expr = parsed!.parts[0] as { operator: string; variables: { name: string }[] };
        assert.equal(expr.operator, '+');
        assert.equal(expr.variables[0].name, 'path');
    });

    it('parses expression with prefix', () => {
        const parsed = parseUriTemplate('{var:3}');
        assert.notEqual(parsed, null);
        const expr = parsed!.parts[0] as { variables: { name: string; prefix: number }[] };
        assert.equal(expr.variables[0].prefix, 3);
    });

    it('parses expression with explode', () => {
        const parsed = parseUriTemplate('{list*}');
        assert.notEqual(parsed, null);
        const expr = parsed!.parts[0] as { variables: { name: string; explode: boolean }[] };
        assert.equal(expr.variables[0].explode, true);
    });
});

// RFC 6570 §1.6: UTF-8 encoding
describe('RFC 6570 §1.6: UTF-8 Encoding', () => {
    it('encodes non-ASCII characters as UTF-8', () => {
        const result = expandUriTemplate('{name}', { name: 'café' });
        assert.equal(result, 'caf%C3%A9');
    });

    it('encodes emoji as UTF-8', () => {
        const result = expandUriTemplate('{emoji}', { emoji: '😀' });
        assert.equal(result, '%F0%9F%98%80');
    });

    it('encodes Chinese characters', () => {
        const result = expandUriTemplate('{text}', { text: '中文' });
        assert.equal(result, '%E4%B8%AD%E6%96%87');
    });
});

// Edge cases
describe('Edge Cases', () => {
    it('handles template with no expressions', () => {
        assert.equal(expandUriTemplate('http://example.com', {}), 'http://example.com');
    });

    it('handles template with only expression', () => {
        assert.equal(expandUriTemplate('{var}', { var: 'value' }), 'value');
    });

    it('handles consecutive expressions', () => {
        assert.equal(expandUriTemplate('{x}{y}', { x: 'a', y: 'b' }), 'ab');
    });

    it('preserves literal percent signs in values when using + operator', () => {
        assert.equal(expandUriTemplate('{+half}', specVars), '50%25');
    });

    it('encodes percent signs in values for simple expansion', () => {
        assert.equal(expandUriTemplate('{half}', specVars), '50%25');
    });

    it('handles null value as undefined', () => {
        assert.equal(expandUriTemplate('{var}', { var: null as unknown as undefined }), '');
    });

    it('works with pre-parsed template', () => {
        const parsed = parseUriTemplate('{var}');
        assert.equal(expandUriTemplate(parsed!, { var: 'value' }), 'value');
    });

    it('returns original template string when parsing fails', () => {
        assert.equal(expandUriTemplate('{unclosed', {}), '{unclosed');
    });
});

// Real-world API examples
describe('Real-world API Examples', () => {
    it('expands GitHub API URL', () => {
        const template = 'https://api.github.com/repos/{owner}/{repo}/issues{?state,labels}';
        const result = expandUriTemplate(template, {
            owner: 'nodejs',
            repo: 'node',
            state: 'open',
            labels: 'bug',
        });
        assert.equal(result, 'https://api.github.com/repos/nodejs/node/issues?state=open&labels=bug');
    });

    it('handles HAL _links template', () => {
        const template = '/api/users{?page,size}';
        assert.equal(
            expandUriTemplate(template, { page: '1', size: '10' }),
            '/api/users?page=1&size=10'
        );
        assert.equal(
            expandUriTemplate(template, { page: '1' }),
            '/api/users?page=1'
        );
        assert.equal(
            expandUriTemplate(template, {}),
            '/api/users'
        );
    });

    it('expands search template with query params', () => {
        const template = '/search{?q,page,per_page}';
        const result = expandUriTemplate(template, {
            q: 'hello world',
            page: '1',
        });
        assert.equal(result, '/search?q=hello%20world&page=1');
    });

    it('expands path segments for nested resources', () => {
        const template = '/api{/version}/users{/id}/posts{/postId}';
        const result = expandUriTemplate(template, {
            version: 'v1',
            id: '123',
            postId: '456',
        });
        assert.equal(result, '/api/v1/users/123/posts/456');
    });

    it('expands fragment for SPA routing', () => {
        const template = '/app{#section}';
        const result = expandUriTemplate(template, { section: 'dashboard' });
        assert.equal(result, '/app#dashboard');
    });
});
