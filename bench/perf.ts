import { performance } from 'node:perf_hooks';
import { applySorting } from '../src/sorting.js';
import { negotiate, getResponseFormat } from '../src/negotiate.js';
import { queryJsonPathNodes } from '../src/jsonpath.js';
import { parseRobotsTxt, isAllowed } from '../src/robots.js';
import { parseApiCatalog } from '../src/linkset.js';
import { percentDecode } from '../src/uri.js';
import { expandUriTemplate } from '../src/uri-template.js';

interface BenchmarkCase {
    name: string;
    iterations: number;
    warmupIterations?: number;
    run: () => void;
}

function runBenchmark(testCase: BenchmarkCase): { msPerOp: number; opsPerSecond: number } {
    const warmup = testCase.warmupIterations ?? Math.min(20, testCase.iterations);

    for (let i = 0; i < warmup; i++) {
        testCase.run();
    }

    const start = performance.now();
    for (let i = 0; i < testCase.iterations; i++) {
        testCase.run();
    }
    const end = performance.now();

    const totalMs = end - start;
    const msPerOp = totalMs / testCase.iterations;
    const opsPerSecond = msPerOp === 0 ? Number.POSITIVE_INFINITY : 1000 / msPerOp;

    return { msPerOp, opsPerSecond };
}

function buildTree(depth: number, width: number): unknown {
    if (depth === 0) {
        return { value: 1 };
    }

    const out: Record<string, unknown> = {};
    for (let i = 0; i < width; i++) {
        out[`k${i}`] = buildTree(depth - 1, width);
    }
    return out;
}

const sortingData = Array.from({ length: 20000 }, (_, index) => ({
    id: index,
    user: {
        profile: {
            score: Math.floor(Math.sin(index) * 100000),
            rank: index % 127,
        },
        name: `User${20000 - index}`,
    },
}));

const acceptParts: string[] = [];
for (let i = 0; i < 40; i++) {
    acceptParts.push(`application/vnd.perf.${i}+json;v=${i % 3};q=${((100 - i) / 100).toFixed(2)}`);
}
acceptParts.push('application/json;q=0.8', 'text/csv;q=0.5', '*/*;q=0.1');
const acceptHeader = acceptParts.join(', ');
const supportedMediaTypes = Array.from({ length: 150 }, (_, index) => (
    `application/vnd.perf.${index}+json;v=${index % 3}`
)).concat(['application/json', 'text/csv']);

const jsonPathDocument = buildTree(6, 5);

let robotsText = 'User-agent: *\n';
for (let i = 0; i < 500; i++) {
    robotsText += `Allow: /public/${i}/*\n`;
    robotsText += `Disallow: /private/${i}/*\n`;
}
const robotsConfig = parseRobotsTxt(robotsText);

const apiCatalogJson = JSON.stringify({
    profile: 'https://www.rfc-editor.org/info/rfc9727',
    linkset: Array.from({ length: 400 }, (_, i) => ({
        anchor: `https://api.example.com/${i}`,
        item: [{ href: `https://api.example.com/${i}/resource`, type: 'application/json' }],
    })),
});

const unicodePathologicalDecodeInput = `%20${'e'.repeat(1000)}${'x'.repeat(1000)}%2F${'y'.repeat(1000)}`;

const benchmarkCases: BenchmarkCase[] = [
    {
        name: 'sorting.applySorting nested fields',
        iterations: 6,
        run: () => {
            applySorting(sortingData, '-user.profile.score,user.name,user.profile.rank');
        },
    },
    {
        name: 'negotiate.negotiate large matrix',
        iterations: 3000,
        run: () => {
            negotiate(acceptHeader, supportedMediaTypes);
        },
    },
    {
        name: 'jsonpath.queryJsonPathNodes $..*',
        iterations: 20,
        run: () => {
            queryJsonPathNodes('$..*', jsonPathDocument);
        },
    },
    {
        name: 'robots.isAllowed repeated checks',
        iterations: 5000,
        run: () => {
            isAllowed(robotsConfig, 'ExampleBot/1.0', '/private/499/secret');
        },
    },
    {
        name: 'linkset.parseApiCatalog large input',
        iterations: 200,
        run: () => {
            parseApiCatalog(apiCatalogJson);
        },
    },
    {
        name: 'uri.percentDecode mixed input',
        iterations: 300,
        run: () => {
            percentDecode(unicodePathologicalDecodeInput);
        },
    },
    {
        name: 'uri-template.expandUriTemplate',
        iterations: 20000,
        run: () => {
            expandUriTemplate('/search{?q,lang,region,tags*}', {
                q: 'cafe and restaurants',
                lang: 'en-US',
                region: 'us-east-1',
                tags: ['food', 'city', 'travel'],
            });
        },
    },
    {
        name: 'negotiate.getResponseFormat',
        iterations: 30000,
        run: () => {
            getResponseFormat('application/json;q=1, text/csv;q=0.5, */*;q=0.1');
        },
    },
];

console.log('http-rfc-utils benchmark suite\n');

for (const benchmarkCase of benchmarkCases) {
    const { msPerOp, opsPerSecond } = runBenchmark(benchmarkCase);
    console.log(
        `${benchmarkCase.name.padEnd(40)} ${msPerOp.toFixed(4).padStart(10)} ms/op  ${opsPerSecond.toFixed(1).padStart(12)} ops/s`
    );
}
