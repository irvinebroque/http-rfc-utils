import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);

interface GitExecError extends Error {
    code?: number | string;
    stderr?: string;
    stdout?: string;
}

function toGitPath(filePath: string): string {
    return filePath.split(path.sep).join('/');
}

async function runGit(cwd: string, args: string[]): Promise<string> {
    try {
        const result = await execFileAsync('git', args, {
            cwd,
            maxBuffer: 10 * 1024 * 1024,
        });
        return result.stdout.trim();
    } catch (error) {
        const gitError = error as GitExecError;
        const detail = (gitError.stderr ?? gitError.message ?? '').trim();
        throw new Error(`git ${args.join(' ')} failed: ${detail}`);
    }
}

export async function resolveMergeBase(cwd: string, baseRef: string): Promise<string> {
    return runGit(cwd, ['merge-base', 'HEAD', baseRef]);
}

export async function getChangedFilesSinceMergeBase(cwd: string, mergeBase: string): Promise<string[]> {
    const output = await runGit(cwd, ['diff', '--name-only', `${mergeBase}..HEAD`]);

    if (output.length === 0) {
        return [];
    }

    return output
        .split(/\r?\n/u)
        .map(filePath => filePath.trim())
        .filter(filePath => filePath.length > 0);
}

export async function listFilesAtRef(cwd: string, ref: string, paths: string[]): Promise<string[]> {
    const normalizedPaths = paths.map(toGitPath);
    const output = await runGit(cwd, ['ls-tree', '-r', '--name-only', ref, '--', ...normalizedPaths]);

    if (output.length === 0) {
        return [];
    }

    return output
        .split(/\r?\n/u)
        .map(filePath => filePath.trim())
        .filter(filePath => filePath.length > 0);
}

function isMissingPathError(error: GitExecError): boolean {
    const stderr = error.stderr ?? '';

    return (
        stderr.includes('exists on disk, but not in') ||
        stderr.includes('does not exist in') ||
        stderr.includes('bad object')
    );
}

export async function readFileAtRef(cwd: string, ref: string, filePath: string): Promise<string | null> {
    const normalizedPath = toGitPath(filePath);

    try {
        const result = await execFileAsync('git', ['show', `${ref}:${normalizedPath}`], {
            cwd,
            maxBuffer: 10 * 1024 * 1024,
        });
        return result.stdout;
    } catch (error) {
        const gitError = error as GitExecError;
        if (isMissingPathError(gitError)) {
            return null;
        }

        const detail = (gitError.stderr ?? gitError.message ?? '').trim();
        throw new Error(`git show ${ref}:${normalizedPath} failed: ${detail}`);
    }
}
