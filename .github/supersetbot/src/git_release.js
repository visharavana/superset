import simpleGit from 'simple-git';

export default class GitRelease {
  constructor(tag, context, from = null) {
    this.tag = tag;
    this.context = context;
    this.prNumberRegex = /#(\d+)/;
    this.commitPrMap = null;
    this.prCommitMap = null;
    this.git = simpleGit();
    this.from = from;
  }

  async load() {
    this.commitPrMap = await this.getCommitPrMap();
    this.prCommitMap = GitRelease.reverseMap(this.commitPrMap);
  }

  static reverseMap(map) {
    return new Map([...map.entries()].map(([key, value]) => [value, key]));
  }

  extractPRNumber(commitMessage) {
    if (commitMessage) {
      const match = commitMessage.match(this.prNumberRegex);
      return match ? parseInt(match[1], 10) : null;
    }
    return null;
  }

  async getCommitPrMap() {
    let from = this.from || await this.git.firstCommit();
    if (from.includes('\n')) {
      [from] = from.split('\n');
    }
    const format = {
      hash: '%H',
      message: '%s',
    };
    const options = [`--format=${JSON.stringify(format)}`];
    const range = `${this.from || 'first'}..${this.tag}`;
    const commits = await this.git.log({ from, to: this.tag, ...options });
    this.context.log(`${range} - fetched ${commits.all.length} commits`);
    const commitPrMap = new Map();
    commits.all.forEach((commit) => {
      const prNumber = this.extractPRNumber(commit.message);
      if (prNumber) {
        commitPrMap.set(commit.hash, prNumber);
      }
    });
    return commitPrMap;
  }
}
