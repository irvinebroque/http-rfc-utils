import fs from 'node:fs/promises';
import path from 'node:path';

const apiRoot = path.resolve('docs/src/content/docs/api');

const isMarkdown = (filePath) => filePath.endsWith('.md');

const walk = async (dir) => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...(await walk(fullPath)));
        } else if (entry.isFile() && isMarkdown(fullPath)) {
            files.push(fullPath);
        }
    }

    return files;
};

const titleFromContent = (content, filePath) => {
    const match = content.match(/^#\s+(.+)$/m);
    if (match) {
        return match[1].trim();
    }

    return path.basename(filePath, '.md');
};

const yamlQuote = (value) => `'${value.replace(/'/g, "''")}'`;

const addFrontmatter = async (filePath) => {
    const content = await fs.readFile(filePath, 'utf8');
    if (content.startsWith('---\n')) {
        return;
    }

    const title = titleFromContent(content, filePath);
    const frontmatter = `---\ntitle: ${yamlQuote(title)}\n---\n\n`;
    await fs.writeFile(filePath, `${frontmatter}${content}`);
};

const main = async () => {
    const files = await walk(apiRoot);
    await Promise.all(files.map(addFrontmatter));
};

await main();
