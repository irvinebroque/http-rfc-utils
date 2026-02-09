const { default: github } = require('@changesets/changelog-github');

module.exports = {
    async getReleaseLine(changeset, type, options) {
        const line = await github.getReleaseLine(changeset, type, options);
        return line.replace(/Thanks (.+?)! - /, 'Contributor: $1 - ');
    },
    getDependencyReleaseLine: github.getDependencyReleaseLine,
};
